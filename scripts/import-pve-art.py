"""Preserve generated PvE artwork and package a grounded runtime standee; not Cubism rigging."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('id', choices=['training_dummy', 'track_golem', 'supply_robot', 'trophy_guardian', 'grand_trophy_guardian'])
p.add_argument('file', type=Path)
a = p.parse_args()
im = Image.open(a.file)
assert im.mode == 'RGBA' and im.getchannel('A').getextrema() == (0, 255), 'Real transparent RGBA required'
source = ROOT / f'docs/art-source/pve/standees/{a.id}.png'
runtime = ROOT / f'public/assets/pve/standees/{a.id}.png'
assert not source.exists() and not runtime.exists(), 'Preserve existing delivery'
for dest in (source, runtime):
    dest.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(a.file, source)
bounds = im.getchannel('A').getbbox()
figure = im.crop(bounds)
figure.thumbnail((384, 384), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (512, 512))
canvas.paste(figure, ((512 - figure.width) // 2, 440 - figure.height))
canvas.save(runtime)
inventory = ROOT / 'src/data/manual/delivered-art.json'
files = set(json.loads(inventory.read_text(encoding='utf-8')))
files.add(runtime.relative_to(ROOT / 'public/assets').as_posix())
inventory.write_text(json.dumps(sorted(files), indent=2) + '\n', encoding='utf-8')
meta_path = ROOT / 'src/data/manual/generated-pve.json'
meta = json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else {}
meta[a.id] = {'source': source.relative_to(ROOT).as_posix(), 'runtime': runtime.relative_to(ROOT).as_posix(), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'runtimeSha256': hashlib.sha256(runtime.read_bytes()).hexdigest(), 'sourceSize': list(im.size), 'crop': bounds, 'size': [512, 512], 'footAnchor': [256, 440], 'status': 'generated-standee-with-procedural-runtime-motion; not-Cubism'}
meta_path.write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
print(a.id, 'standee imported')
