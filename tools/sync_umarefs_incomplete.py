#!/usr/bin/env python3
"""Recover UmaRefs characters marked Incomplete without reloading Carrd per card.

The page is loaded once. For each unresolved character, this script locates the
exact character-name substring with a DOM Range, captures the real link target
under that text while preventing navigation, and downloads only *-Race.png from
the linked Google Drive folder. This avoids Carrd throttling caused by opening
the site repeatedly.
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
        r"""
        (name) => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(node) {
                return (node.nodeValue || '').includes(name)
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
          return {x:r.x, y:r.y, width:r.width, height:r.height};
        }
        """,
        name,
    )


def drive_url_at_point(page, x: float, y: float) -> str | None:
    return page.evaluate(
        r"""
        ({x,y}) => {
          const drive = u => /(drive|docs)\.google\.com|drive\.(usercontent|googleusercontent)\.google\.com/i.test(u || '');
          const els = document.elementsFromPoint(x,y);
          for (const initial of els) {
            let el = initial;
            for (let depth=0; el && depth<8; depth++, el=el.parentElement) {
              if (el.href && drive(el.href)) return el.href;
              for (const attr of Array.from(el.attributes || [])) {
                const value = attr.value || '';
                const m = value.match(/https?:\/\/(?:drive\.google\.com|docs\.google\.com|drive\.(?:usercontent|googleusercontent)\.google\.com)\/[^\"'<>\s]+/i);
                if (m) return m[0];
              }
            }
          }
          return null;
        }
        """,
        {"x": x, "y": y},
    )


def nearby_drive_anchor(page, x: float, y: float) -> str | None:
    return page.evaluate(
        r"""
        ({x,y}) => {
          const drive = u => /(drive|docs)\.google\.com|drive\.(usercontent|googleusercontent)\.google\.com/i.test(u || '');
          const anchors = Array.from(document.querySelectorAll('a[href]')).filter(a => drive(a.href));
          let best = null;
          for (const a of anchors) {
            const r = a.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            const contains = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
            const dx = Math.max(r.left-x, 0, x-r.right);
            const dy = Math.max(r.top-y, 0, y-r.bottom);
            const distance = Math.hypot(dx,dy);
            const score = contains ? -100000 : distance;
            if (!best || score < best.score) best = {href:a.href, score};
          }
          return best && best.score <= 45 ? best.href : null;
        }
        """,
        {"x": x, "y": y},
    )


def resolve_character_url(page, name: str) -> tuple[str | None, str]:
    rect = locate_name_range(page, name)
    if not rect:
        return None, "text-range-not-found"
    page.wait_for_timeout(150)
    rect = locate_name_range(page, name)
    if not rect:
        return None, "text-range-lost-after-scroll"

    cx = rect["x"] + rect["width"] / 2
    cy = rect["y"] + rect["height"] / 2

    direct = drive_url_at_point(page, cx, cy)
    if direct and is_drive(direct):
        return direct, "element-at-text-point"

    nearby = nearby_drive_anchor(page, cx, cy)
    if nearby and is_drive(nearby):
        return nearby, "nearby-anchor"

    # Last resort: capture the real trusted click target while preventing the
    # browser from leaving UmaRefs. The listener is installed in capture phase.
    page.evaluate(
        r"""
        () => {
          window.__umarefsCapturedHref = null;
          if (!window.__umarefsCaptureInstalled) {
            document.addEventListener('click', (event) => {
              let el = event.target;
              while (el && el !== document) {
                if (el.href) {
                  window.__umarefsCapturedHref = el.href;
                  break;
                }
                el = el.parentElement;
              }
              event.preventDefault();
              event.stopImmediatePropagation();
              event.stopPropagation();
            }, true);
            window.__umarefsCaptureInstalled = true;
          }
        }
        """
    )
    page.mouse.click(cx, cy)
    page.wait_for_timeout(250)
    captured = page.evaluate("() => window.__umarefsCapturedHref")
    if captured and is_drive(captured):
        return captured, "captured-click-href"
    return None, "no-drive-target-at-card"


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
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        page.goto(base.SOURCE_PAGE, wait_until="domcontentloaded", timeout=120_000)
        try:
            page.wait_for_load_state("networkidle", timeout=20_000)
        except PlaywrightTimeoutError:
            pass
        page.wait_for_timeout(1800)
        print(f"[UmaRefs incomplete] page loaded once; targets={len(targets)}")

        temp_root = Path(td)
        for i, record in enumerate(targets, 1):
            name = record["character_name"]
            print(f"[{i}/{len(targets)}] {name}: resolving source card")
            url, method = resolve_character_url(page, name)
            result = {"character_name": name, "drive_url": url, "discovery_method": method}

            if not url:
                record["drive_url"] = None
                record["status"] = "incomplete-no-drive-link"
                record.pop("error", None)
                result["status"] = record["status"]
                results.append(result)
                print(f"    no Drive target ({method})")
                continue

            print(f"    Drive target: {url}")
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
        f"[UmaRefs incomplete] recovered_now={sum(1 for x in results if x.get('status') == 'ok')} "
        f"remaining={sum(1 for x in results if x.get('status') != 'ok')} "
        f"total_ok={manifest['ok_count']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
