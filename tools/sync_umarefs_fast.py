#!/usr/bin/env python3
"""Fast UmaRefs sync: list each Drive folder, then download only *-Race.png."""

from __future__ import annotations

import re
from pathlib import Path

import gdown
import sync_umarefs as base


def _compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def fast_download_from_drive(url: str, character_name: str, temp_root: Path):
    if not re.search(r"/folders/|drive/folders", url, re.IGNORECASE):
        return base._original_download_from_drive(url, character_name, temp_root)

    char_tmp = temp_root / re.sub(r"[^A-Za-z0-9._-]+", "_", character_name)
    char_tmp.mkdir(parents=True, exist_ok=True)

    try:
        files = gdown.download_folder(
            url=url,
            output=str(char_tmp),
            quiet=True,
            use_cookies=False,
            remaining_ok=True,
            skip_download=True,
        )
        if not files:
            return None, "Drive folder listing returned no files"

        race_files = [f for f in files if Path(f.path).name.lower().endswith("-race.png")]
        if not race_files:
            return None, "No *-Race.png found in Drive folder"

        expected = _compact(character_name)
        exact = []
        for item in race_files:
            stem = Path(item.path).stem
            stem_without_race = re.sub(r"(?i)-?race$", "", stem)
            if _compact(stem_without_race) == expected:
                exact.append(item)

        if len(exact) == 1:
            chosen = exact[0]
        elif len(race_files) == 1:
            chosen = race_files[0]
        else:
            names = ", ".join(Path(f.path).name for f in race_files)
            return None, f"Multiple ambiguous Race PNGs: {names}"

        target = char_tmp / Path(chosen.path).name
        result = gdown.download(
            id=chosen.id,
            output=str(target),
            quiet=False,
            use_cookies=False,
        )
        if not result:
            return None, f"Failed to download {Path(chosen.path).name}"
        return Path(result), None
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


if __name__ == "__main__":
    base._original_download_from_drive = base.download_from_drive
    base.download_from_drive = fast_download_from_drive
    raise SystemExit(base.main())
