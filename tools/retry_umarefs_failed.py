#!/usr/bin/env python3
"""Retry only failed UmaRefs Race image downloads from the existing manifest.

This is intentionally separate from initial discovery so a fresh GitHub runner
can resume after Google Drive throttles a long batch. Existing verified images
are never re-downloaded. Entries marked Incomplete by UmaRefs are normalized to
`incomplete` and are not guessed from neighboring character links.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import sync_umarefs as base
import sync_umarefs_fast as fast


def main() -> int:
    if not base.MANIFEST_PATH.exists():
        raise SystemExit(f"Missing manifest: {base.MANIFEST_PATH}")

    manifest = json.loads(base.MANIFEST_PATH.read_text(encoding="utf-8"))
    records = manifest.get("characters", [])

    # Make the fast helper's direct-file fallback safe when imported as a module.
    if not hasattr(base, "_original_download_from_drive"):
        base._original_download_from_drive = base.download_from_drive

    # Never fabricate links/assets for source cards explicitly marked Incomplete.
    for record in records:
        if record.get("incomplete_on_source"):
            for key in ("file_name", "path", "width", "height", "bytes", "sha256", "error"):
                record.pop(key, None)
            record["drive_url"] = None
            record["status"] = "incomplete"

    retry_records = [
        r for r in records
        if not r.get("incomplete_on_source")
        and r.get("status") != "ok"
        and r.get("drive_url")
    ]

    print(f"[UmaRefs retry] retryable={len(retry_records)} total={len(records)}")

    with tempfile.TemporaryDirectory(prefix="umarefs-retry-") as td:
        temp_root = Path(td)
        for index, record in enumerate(retry_records, start=1):
            name = record["character_name"]
            url = record["drive_url"]
            print(f"[{index}/{len(retry_records)}] {name}: retrying")

            downloaded, error = fast.fast_download_from_drive(url, name, temp_root)
            if not downloaded:
                record["status"] = "download-error"
                record["error"] = error
                print(f"    ERROR: {error}")
                continue

            try:
                asset = base.validate_and_store(downloaded, name)
                record.update(asset)
                record.pop("error", None)
                record["status"] = "ok"
                print(f"    -> {asset['file_name']} ({asset['width']}x{asset['height']}, {asset['bytes']} bytes)")
            except Exception as exc:
                record["status"] = "validation-error"
                record["error"] = f"{type(exc).__name__}: {exc}"
                print(f"    VALIDATION ERROR: {record['error']}")

    ok_count = sum(1 for r in records if r.get("status") == "ok")
    incomplete_count = sum(1 for r in records if r.get("status") == "incomplete")
    failure_count = sum(
        1 for r in records
        if not r.get("incomplete_on_source") and r.get("status") != "ok"
    )

    manifest["ok_count"] = ok_count
    manifest["incomplete_count"] = incomplete_count
    manifest["failure_count"] = failure_count
    manifest["characters"] = records
    manifest["last_retry_at"] = base.utc_now()
    base.MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print(
        f"[UmaRefs retry] ok={ok_count} incomplete={incomplete_count} "
        f"failures={failure_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
