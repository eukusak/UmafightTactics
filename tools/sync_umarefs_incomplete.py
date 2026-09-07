#!/usr/bin/env python3
"""Recover UmaRefs characters marked Incomplete by physically clicking cards.

Carrd can place an invisible link overlay beside/above the visible text, so a
DOM parent lookup may miss the actual Google Drive target. This script uses
Playwright mouse clicks at each incomplete character label, captures popup or
same-tab navigation, and downloads the Race PNG when a Drive target exists.
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
    return host in {"drive.google.com", "docs.google.com", "drive.usercontent.google.com"}


def click_character_for_url(context, name: str) -> tuple[str | None, str]:
    page = context.new_page()
    try:
        page.goto(base.SOURCE_PAGE, wait_until="domcontentloaded", timeout=120_000)
        try:
            page.wait_for_load_state("networkidle", timeout=20_000)
        except PlaywrightTimeoutError:
            pass
        page.wait_for_timeout(1000)

        # Exact visible-text match. Carrd may wrap the text in multiple spans, so
        # pick the smallest visible element whose normalized text is exact.
        handle = page.evaluate_handle(
            """
            (name) => {
              const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
              const els = Array.from(document.querySelectorAll('body *'))
                .filter(el => norm(el.textContent) === name)
                .filter(el => {
                  const r = el.getBoundingClientRect();
                  const s = getComputedStyle(el);
                  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
                });
              els.sort((a,b) => {
                const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
                return (ra.width * ra.height) - (rb.width * rb.height);
              });
              return els[0] || null;
            }
            """,
            name,
        )
        el = handle.as_element()
        if not el:
            return None, "text-not-found"
        box = el.bounding_box()
        if not box:
            return None, "no-bounding-box"

        before_pages = set(context.pages)
        before_url = page.url
        cx = box["x"] + box["width"] / 2
        cy = box["y"] + box["height"] / 2
        page.mouse.click(cx, cy)
        page.wait_for_timeout(1800)

        # Check new popup/window first.
        for candidate in context.pages:
            if candidate not in before_pages:
                try:
                    candidate.wait_for_load_state("domcontentloaded", timeout=10_000)
                except Exception:
                    pass
                if is_drive(candidate.url):
                    return candidate.url, "physical-click-popup"

        # Then same-tab navigation.
        if page.url != before_url and is_drive(page.url):
            return page.url, "physical-click-same-tab"

        # Some cards use a sibling/overlay anchor. Find the closest Drive anchor
        # to the clicked label by screen geometry as a secondary exact-card test.
        geometric = page.evaluate(
            """
            ({name}) => {
              const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
              const drive = u => /(drive|docs)\\.google\\.com|drive\\.usercontent\\.google\\.com/i.test(u || '');
              const labels = Array.from(document.querySelectorAll('body *')).filter(el => norm(el.textContent) === name);
              if (!labels.length) return null;
              labels.sort((a,b) => {
                const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
                return (ra.width*ra.height)-(rb.width*rb.height);
              });
              const r = labels[0].getBoundingClientRect();
              const cx = r.left + r.width/2, cy = r.top + r.height/2;
              const anchors = Array.from(document.querySelectorAll('a[href]')).filter(a => drive(a.href));
              let best = null;
              for (const a of anchors) {
                const ar = a.getBoundingClientRect();
                if (ar.width <= 0 || ar.height <= 0) continue;
                const contains = cx >= ar.left && cx <= ar.right && cy >= ar.top && cy <= ar.bottom;
                const dx = Math.max(ar.left-cx, 0, cx-ar.right);
                const dy = Math.max(ar.top-cy, 0, cy-ar.bottom);
                const d = Math.hypot(dx,dy);
                const score = contains ? -100000 : d;
                if (!best || score < best.score) best = {href:a.href, score};
              }
              // Only accept a nearby/overlapping card anchor; never borrow the
              // previous/next character's link merely because it is in the HTML.
              return best && best.score <= 80 ? best.href : null;
            }
            """,
            {"name": name},
        )
        if geometric and is_drive(geometric):
            return geometric, "geometry-anchor"
        return None, "no-drive-navigation"
    finally:
        page.close()


def main() -> int:
    if not base.MANIFEST_PATH.exists():
        raise SystemExit(f"Missing manifest: {base.MANIFEST_PATH}")

    manifest = json.loads(base.MANIFEST_PATH.read_text(encoding="utf-8"))
    records = manifest.get("characters", [])
    targets = [r for r in records if r.get("incomplete_on_source")]

    if not hasattr(base, "_original_download_from_drive"):
        base._original_download_from_drive = base.download_from_drive

    results = []
    with sync_playwright() as p, tempfile.TemporaryDirectory(prefix="umarefs-incomplete-") as td:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1200})
        temp_root = Path(td)

        for i, record in enumerate(targets, 1):
            name = record["character_name"]
            print(f"[{i}/{len(targets)}] {name}: clicking source card")
            url, method = click_character_for_url(context, name)
            result = {"character_name": name, "drive_url": url, "discovery_method": method}

            if not url:
                record["drive_url"] = None
                record["status"] = "incomplete-no-drive-link"
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
