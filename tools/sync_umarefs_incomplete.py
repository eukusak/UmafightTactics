#!/usr/bin/env python3
"""Recover UmaRefs characters marked Incomplete by physically clicking cards.

Carrd can render a character name and the '(Incomplete)' marker inside the same
text container. This script therefore locates the exact substring using a DOM
Range, clicks the screen coordinates of the character-name text itself, captures
popup/same-tab Google Drive navigation, and downloads the Race PNG when one is
actually available.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

import sync_umarefs as base
import sync_umarefs_fast as fast


def is_drive(url: str | None) -> bool:
    if not url:
        return False
    host = (urlparse(url).hostname or "").lower()
    return host in {
        "drive.google.com",
        "docs.google.com",
        "drive.usercontent.google.com",
        "drive.googleusercontent.com",
    }


def locate_name_range(page, name: str) -> dict | None:
    """Return viewport coordinates for the exact character-name substring."""
    return page.evaluate(
        """
        (name) => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(node) {
                const value = node.nodeValue || '';
                return value.includes(name)
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              }
            }
          );

          let node;
          const candidates = [];
          while ((node = walker.nextNode())) {
            const value = node.nodeValue || '';
            let start = 0;
            while (true) {
              const idx = value.indexOf(name, start);
              if (idx < 0) break;
              const range = document.createRange();
              range.setStart(node, idx);
              range.setEnd(node, idx + name.length);
              const rect = range.getBoundingClientRect();
              const parent = node.parentElement;
              if (parent && rect.width > 0 && rect.height > 0) {
                const style = getComputedStyle(parent);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                  candidates.push({node, parent, idx, area: rect.width * rect.height});
                }
              }
              start = idx + name.length;
            }
          }

          if (!candidates.length) return null;
          candidates.sort((a,b) => a.area - b.area);
          const best = candidates[0];
          best.parent.scrollIntoView({block:'center', inline:'center'});
          const range = document.createRange();
          range.setStart(best.node, best.idx);
          range.setEnd(best.node, best.idx + name.length);
          const r = range.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            parentText: (best.parent.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240)
          };
        }
        """,
        name,
    )


def nearby_drive_anchor(page, name: str) -> str | None:
    """Accept only a Drive anchor spatially overlapping/near the exact text range."""
    return page.evaluate(
        """
        (name) => {
          const drive = u => /(drive|docs)\.google\.com|drive\.(usercontent|googleusercontent)\.google\.com/i.test(u || '');

          function findRange() {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            let best = null;
            while ((node = walker.nextNode())) {
              const value = node.nodeValue || '';
              const idx = value.indexOf(name);
              if (idx < 0) continue;
              const range = document.createRange();
              range.setStart(node, idx);
              range.setEnd(node, idx + name.length);
              const r = range.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue;
              const area = r.width * r.height;
              if (!best || area < best.area) best = {rect:r, area};
            }
            return best ? best.rect : null;
          }

          const r = findRange();
          if (!r) return null;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const anchors = Array.from(document.querySelectorAll('a[href]')).filter(a => drive(a.href));
          let best = null;
          for (const a of anchors) {
            const ar = a.getBoundingClientRect();
            if (ar.width <= 0 || ar.height <= 0) continue;
            const contains = cx >= ar.left && cx <= ar.right && cy >= ar.top && cy <= ar.bottom;
            const dx = Math.max(ar.left - cx, 0, cx - ar.right);
            const dy = Math.max(ar.top - cy, 0, cy - ar.bottom);
            const distance = Math.hypot(dx, dy);
            const score = contains ? -100000 : distance;
            if (!best || score < best.score) best = {href:a.href, score};
          }
          // Tight threshold prevents borrowing a neighboring character's link.
          return best && best.score <= 45 ? best.href : null;
        }
        """,
        name,
    )


def click_character_for_url(context, name: str) -> tuple[str | None, str]:
    page = context.new_page()
    popup_pages = []
    try:
        page.goto(base.SOURCE_PAGE, wait_until="domcontentloaded", timeout=120_000)
        try:
            page.wait_for_load_state("networkidle", timeout=20_000)
        except PlaywrightTimeoutError:
            pass
        page.wait_for_timeout(1200)

        rect = locate_name_range(page, name)
        if not rect:
            return None, "text-range-not-found"
        page.wait_for_timeout(200)

        # Recompute after scroll because Range coordinates are viewport-relative.
        rect = locate_name_range(page, name)
        if not rect:
            return None, "text-range-lost-after-scroll"

        before_pages = set(context.pages)
        before_url = page.url
        cx = rect["x"] + rect["width"] / 2
        cy = rect["y"] + rect["height"] / 2
        page.mouse.click(cx, cy)
        page.wait_for_timeout(1600)

        for candidate in context.pages:
            if candidate not in before_pages:
                popup_pages.append(candidate)
                try:
                    candidate.wait_for_load_state("domcontentloaded", timeout=10_000)
                except Exception:
                    pass
                if is_drive(candidate.url):
                    return candidate.url, "text-range-click-popup"

        if page.url != before_url and is_drive(page.url):
            return page.url, "text-range-click-same-tab"

        geometric = nearby_drive_anchor(page, name)
        if geometric and is_drive(geometric):
            return geometric, "text-range-nearby-anchor"
        return None, "no-drive-navigation"
    finally:
        for popup in popup_pages:
            try:
                if not popup.is_closed():
                    popup.close()
            except Exception:
                pass
        try:
            if not page.is_closed():
                page.close()
        except Exception:
            pass


def main() -> int:
    if not base.MANIFEST_PATH.exists():
        raise SystemExit(f"Missing manifest: {base.MANIFEST_PATH}")

    manifest = json.loads(base.MANIFEST_PATH.read_text(encoding="utf-8"))
    records = manifest.get("characters", [])
    targets = [r for r in records if r.get("incomplete_on_source") and r.get("status") != "ok"]

    if not hasattr(base, "_original_download_from_drive"):
        base._original_download_from_drive = base.download_from_drive

    results = []
    with sync_playwright() as p, tempfile.TemporaryDirectory(prefix="umarefs-incomplete-") as td:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1200})
        temp_root = Path(td)

        for i, record in enumerate(targets, 1):
            name = record["character_name"]
            print(f"[{i}/{len(targets)}] {name}: locating/clicking source card")
            url, method = click_character_for_url(context, name)
            result = {"character_name": name, "drive_url": url, "discovery_method": method}

            if not url:
                record["drive_url"] = None
                record["status"] = "incomplete-no-drive-link"
                record.pop("error", None)
                result["status"] = record["status"]
                results.append(result)
                print(f"    no Drive navigation ({method})")
                continue

            record["drive_url"] = url
            downloaded, error = fast.fast_download_from_drive(url, name, temp_root)
            if not downloaded:
                record["status"] = "incomplete-drive-no-race"
                record["error"] = error
                result["status"] = record["status"]
                result["error"] = error
                results.append(result)
                print(f"    Drive found but Race download failed: {error}")
                continue

            try:
                asset = base.validate_and_store(downloaded, name)
                record.update(asset)
                record.pop("error", None)
                record["status"] = "ok"
                result.update(asset)
                result["status"] = "ok"
                results.append(result)
                print(f"    -> {asset['file_name']} ({asset['width']}x{asset['height']})")
            except Exception as exc:
                record["status"] = "validation-error"
                record["error"] = f"{type(exc).__name__}: {exc}"
                result["status"] = record["status"]
                result["error"] = record["error"]
                results.append(result)
                print(f"    validation error: {record['error']}")

        browser.close()

    manifest["ok_count"] = sum(1 for r in records if r.get("status") == "ok")
    manifest["incomplete_count"] = sum(1 for r in records if r.get("incomplete_on_source") and r.get("status") != "ok")
    manifest["failure_count"] = sum(1 for r in records if not r.get("incomplete_on_source") and r.get("status") != "ok")
    manifest["last_incomplete_attempt_at"] = base.utc_now()
    manifest["characters"] = records
    base.MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    out = base.OUT_DIR / "incomplete_attempt.json"
    out.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        f"[UmaRefs incomplete] recovered={sum(1 for x in results if x.get('status') == 'ok')} "
        f"remaining={sum(1 for x in results if x.get('status') != 'ok')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
