#!/usr/bin/env python3
"""Synchronize UmaRefs playable-character race reference PNGs.

The source page is a Carrd site whose character cards point to public Google
Drive files/folders. This script renders the page with Playwright, discovers the
Drive URL associated with each character in the main character section, and
keeps only the `*-Race.png` image for the local game asset database.

Output:
  public/assets/characters/race/*.png
  public/assets/characters/race/manifest.json
  public/assets/characters/race/discovery_debug.json

NPC and outfit sections are intentionally excluded.
"""

from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote

import gdown
from PIL import Image
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

SOURCE_PAGE = "https://umarefs.crd.co/"
OUT_DIR = Path("public/assets/characters/race")
MANIFEST_PATH = OUT_DIR / "manifest.json"
DEBUG_PATH = OUT_DIR / "discovery_debug.json"

DRIVE_RE = re.compile(
    r"https?://(?:drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com)/[^\"'<>\\\s]+",
    re.IGNORECASE,
)

SKIP_LINES = {
    "Navigation",
    "Social",
    "Outfits",
    "NPCs",
    "Top",
    "Trello",
    "Twitter",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def fallback_filename(character_name: str) -> str:
    compact = re.sub(r"[^A-Za-z0-9]+", "", character_name)
    return f"{compact}-Race.png"


def clean_drive_url(url: str) -> str:
    value = html_lib.unescape(unquote(url)).strip()
    value = value.replace("\\/", "/")
    return value.rstrip("),.;]}")


def parse_character_section(body_text: str) -> tuple[list[str], set[str]]:
    raw_lines = [re.sub(r"\s+", " ", line).strip() for line in body_text.splitlines()]
    lines = [line for line in raw_lines if line]

    try:
        start = lines.index("Special Week")
    except ValueError as exc:
        raise RuntimeError("Could not find the start of the UmaRefs character list.") from exc

    end = None
    for i in range(start + 1, len(lines)):
        if lines[i] == "NPCs":
            end = i
            break
    if end is None:
        raise RuntimeError("Could not find the NPCs section boundary on UmaRefs.")

    names: list[str] = []
    incomplete: set[str] = set()
    last_name: str | None = None

    for line in lines[start:end]:
        if line in SKIP_LINES:
            continue
        if "Incomplete" in line:
            if last_name:
                incomplete.add(last_name)
            continue
        if len(line) <= 1 or line.startswith("DISCLAIMER"):
            continue
        if line not in names:
            names.append(line)
            last_name = line

    return names, incomplete


def extract_all_drive_urls_from_html(page_html: str) -> list[str]:
    decoded = html_lib.unescape(page_html).replace("\\/", "/")
    seen: set[str] = set()
    urls: list[str] = []
    for match in DRIVE_RE.finditer(decoded):
        url = clean_drive_url(match.group(0))
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def discover_dom_url(page, character_name: str) -> str | None:
    result = page.evaluate(
        """
        (name) => {
          const driveRe = /(drive|docs)\\.google\\.com|drive\\.usercontent\\.google\\.com/i;
          const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
          const all = Array.from(document.querySelectorAll('body *'));
          const matches = all.filter(el => normalize(el.textContent) === name);

          function urlFromElement(el) {
            if (!el) return null;
            const props = [];
            if (el.href) props.push(el.href);
            for (const attr of Array.from(el.attributes || [])) props.push(attr.value);
            for (const value of props) {
              if (typeof value === 'string' && driveRe.test(value)) {
                const m = value.match(/https?:\\/\\/(?:drive\\.google\\.com|docs\\.google\\.com|drive\\.usercontent\\.google\\.com)\\/[^\\"'<>\\s]+/i);
                if (m) return m[0].replace(/\\\\\\//g, '/');
              }
            }
            return null;
          }

          for (const el of matches) {
            let cur = el;
            for (let depth = 0; cur && depth < 6; depth++, cur = cur.parentElement) {
              const direct = urlFromElement(cur);
              if (direct) return direct;
              const anchors = Array.from(cur.querySelectorAll('a[href]'));
              const driveAnchors = anchors.filter(a => driveRe.test(a.href));
              if (driveAnchors.length === 1) return driveAnchors[0].href;
            }
          }

          for (const a of Array.from(document.querySelectorAll('a[href]'))) {
            if (driveRe.test(a.href) && normalize(a.textContent) === name) return a.href;
          }
          return null;
        }
        """,
        character_name,
    )
    return clean_drive_url(result) if result else None


def discover_nearest_html_url(page_html: str, character_name: str, all_urls: list[str]) -> str | None:
    if not all_urls:
        return None
    decoded = html_lib.unescape(page_html).replace("\\/", "/")
    name_matches = list(re.finditer(re.escape(character_name), decoded, re.IGNORECASE))
    if not name_matches:
        return None

    url_positions: list[tuple[int, str]] = []
    for url in all_urls:
        pos = decoded.find(url)
        if pos >= 0:
            url_positions.append((pos, url))
    if not url_positions:
        return None

    best_distance = None
    best_url = None
    for nm in name_matches:
        for pos, url in url_positions:
            distance = abs(pos - nm.start())
            if best_distance is None or distance < best_distance:
                best_distance = distance
                best_url = url

    if best_distance is not None and best_distance <= 12000:
        return best_url
    return None


def discover_links(page, names: list[str]) -> tuple[dict[str, str], dict[str, Any]]:
    page_html = page.content()
    all_urls = extract_all_drive_urls_from_html(page_html)

    mapping: dict[str, str] = {}
    method: dict[str, str] = {}
    for name in names:
        url = discover_dom_url(page, name)
        if url:
            mapping[name] = url
            method[name] = "dom"
            continue
        url = discover_nearest_html_url(page_html, name, all_urls)
        if url:
            mapping[name] = url
            method[name] = "html-nearest"

    unresolved = [n for n in names if n not in mapping]
    used_urls = set(mapping.values())
    unused_urls = [u for u in all_urls if u not in used_urls]
    if unresolved and len(unresolved) == len(unused_urls):
        for name, url in zip(unresolved, unused_urls):
            mapping[name] = url
            method[name] = "ordered-fallback"

    debug = {
        "generated_at": utc_now(),
        "source_page": SOURCE_PAGE,
        "character_count": len(names),
        "drive_url_count": len(all_urls),
        "drive_urls": all_urls,
        "mapping_method": method,
        "unresolved": [n for n in names if n not in mapping],
    }
    return mapping, debug


def find_race_png(paths: list[Path], character_name: str) -> Path | None:
    pngs: list[Path] = []
    for p in paths:
        if p.is_file() and p.suffix.lower() == ".png":
            pngs.append(p)
        elif p.is_dir():
            pngs.extend(q for q in p.rglob("*.png") if q.is_file())

    if not pngs:
        return None

    race = [p for p in pngs if p.name.lower().endswith("-race.png")]
    if len(race) == 1:
        return race[0]

    compact = re.sub(r"[^a-z0-9]+", "", character_name.lower())
    exactish = []
    for p in race:
        stem = re.sub(r"[^a-z0-9]+", "", p.stem.lower().replace("race", ""))
        if stem == compact:
            exactish.append(p)
    if len(exactish) == 1:
        return exactish[0]

    if len(pngs) == 1:
        return pngs[0]
    return None


def download_from_drive(url: str, character_name: str, temp_root: Path) -> tuple[Path | None, str | None]:
    char_tmp = temp_root / re.sub(r"[^A-Za-z0-9._-]+", "_", character_name)
    char_tmp.mkdir(parents=True, exist_ok=True)

    try:
        downloaded_paths: list[Path] = []
        if re.search(r"/folders/|drive/folders", url, re.IGNORECASE):
            result = gdown.download_folder(
                url=url,
                output=str(char_tmp),
                quiet=False,
                use_cookies=False,
                remaining_ok=True,
            )
            if result:
                downloaded_paths.extend(Path(p) for p in result)
        else:
            cwd = Path.cwd()
            try:
                os.chdir(char_tmp)
                result = gdown.download(
                    url=url,
                    output=None,
                    quiet=False,
                    fuzzy=True,
                    use_cookies=False,
                )
            finally:
                os.chdir(cwd)
            if result:
                p = Path(result)
                if not p.is_absolute():
                    p = char_tmp / p.name
                downloaded_paths.append(p)

        candidate = find_race_png(downloaded_paths or [char_tmp], character_name)
        if not candidate:
            return None, "Drive download succeeded but no unambiguous *-Race.png was found"
        return candidate, None
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def validate_and_store(source: Path, character_name: str) -> dict[str, Any]:
    with Image.open(source) as img:
        img.verify()
    with Image.open(source) as img:
        fmt = (img.format or "").upper()
        width, height = img.size
    if fmt != "PNG":
        raise ValueError(f"Expected PNG, got {fmt or 'unknown'}")

    original_name = source.name
    if not original_name.lower().endswith(".png"):
        original_name = fallback_filename(character_name)
    if not original_name.lower().endswith("-race.png"):
        original_name = fallback_filename(character_name)

    original_name = Path(original_name).name.replace("/", "_").replace("\\", "_")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    destination = OUT_DIR / original_name
    shutil.copy2(source, destination)

    return {
        "file_name": original_name,
        "path": destination.as_posix(),
        "width": width,
        "height": height,
        "bytes": destination.stat().st_size,
        "sha256": sha256_file(destination),
    }


def existing_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.exists():
        return {}
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> int:
    global SOURCE_PAGE

    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=SOURCE_PAGE)
    parser.add_argument("--limit", type=int, default=0, help="0 means all characters")
    parser.add_argument("--discovery-only", action="store_true")
    args = parser.parse_args()

    SOURCE_PAGE = args.source
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[UmaRefs] loading {SOURCE_PAGE}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        page.goto(SOURCE_PAGE, wait_until="domcontentloaded", timeout=120_000)
        try:
            page.wait_for_load_state("networkidle", timeout=30_000)
        except PlaywrightTimeoutError:
            print("[UmaRefs] networkidle timeout; continuing with rendered DOM")
        page.wait_for_timeout(2500)

        body_text = page.locator("body").inner_text()
        names, incomplete = parse_character_section(body_text)
        if args.limit > 0:
            names = names[: args.limit]
        mapping, debug = discover_links(page, names)
        browser.close()

    DEBUG_PATH.write_text(json.dumps(debug, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[UmaRefs] characters={len(names)} drive-mapped={len(mapping)} incomplete={len(incomplete)}")

    old = existing_manifest()
    old_by_name = {x.get("character_name"): x for x in old.get("characters", []) if x.get("character_name")}

    records: list[dict[str, Any]] = []
    failures = 0

    with tempfile.TemporaryDirectory(prefix="umarefs-") as td:
        temp_root = Path(td)
        for index, name in enumerate(names, start=1):
            url = mapping.get(name)
            record: dict[str, Any] = {
                "character_name": name,
                "incomplete_on_source": name in incomplete,
                "source_page": SOURCE_PAGE,
                "drive_url": url,
            }

            if name in incomplete and not url:
                record["status"] = "incomplete"
                records.append(record)
                print(f"[{index}/{len(names)}] {name}: incomplete/no link")
                continue

            if not url:
                previous = old_by_name.get(name, {})
                previous_path = previous.get("path")
                if previous_path and Path(previous_path).exists():
                    record.update(previous)
                    record["status"] = "kept-existing-unresolved-link"
                    records.append(record)
                    print(f"[{index}/{len(names)}] {name}: kept existing image; link unresolved")
                    continue
                record["status"] = "link-not-found"
                failures += 1
                records.append(record)
                print(f"[{index}/{len(names)}] {name}: LINK NOT FOUND")
                continue

            if args.discovery_only:
                record["status"] = "discovered"
                records.append(record)
                print(f"[{index}/{len(names)}] {name}: discovered")
                continue

            print(f"[{index}/{len(names)}] {name}: downloading")
            downloaded, error = download_from_drive(url, name, temp_root)
            if not downloaded:
                previous = old_by_name.get(name, {})
                previous_path = previous.get("path")
                if previous_path and Path(previous_path).exists():
                    record.update(previous)
                    record["drive_url"] = url
                    record["status"] = "kept-existing-download-error"
                    record["error"] = error
                    records.append(record)
                    print(f"    kept existing image; {error}")
                    continue
                record["status"] = "download-error"
                record["error"] = error
                failures += 1
                records.append(record)
                print(f"    ERROR: {error}")
                continue

            try:
                asset = validate_and_store(downloaded, name)
                record.update(asset)
                record["status"] = "ok"
                records.append(record)
                print(f"    -> {asset['file_name']} ({asset['width']}x{asset['height']}, {asset['bytes']} bytes)")
            except Exception as exc:
                record["status"] = "validation-error"
                record["error"] = f"{type(exc).__name__}: {exc}"
                failures += 1
                records.append(record)
                print(f"    VALIDATION ERROR: {record['error']}")

    manifest = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "source": "UmaRefs",
        "source_page": SOURCE_PAGE,
        "asset_type": "character-race-reference",
        "npcs_included": False,
        "outfits_included": False,
        "character_count": len(names),
        "ok_count": sum(1 for r in records if r.get("status") == "ok"),
        "incomplete_count": sum(1 for r in records if r.get("incomplete_on_source")),
        "failure_count": failures,
        "characters": records,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[UmaRefs] manifest written to {MANIFEST_PATH}")
    if failures:
        print(f"[UmaRefs] completed with {failures} unresolved/download failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
