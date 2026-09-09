"""Crop/resize an inspected generated RGBA figure without altering its alpha.
This imports a static figure and portrait, NOT a 50-pose battle sheet.
Usage: python3 scripts/import-standee.py ID FILE --face LEFT TOP RIGHT BOTTOM
"""
from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('id'); p.add_argument('file', type=Path)
p.add_argument('--face', type=int, nargs=4, required=True)
a = p.parse_args()
units = json.loads((ROOT/'src/data/generated/all-units.json').read_text())['units']
unit = next((u for u in units if u['id'] == a.id), None)
if not unit: p.error('Unknown unit ID')
im = Image.open(a.file)
if im.mode != 'RGBA' or im.getchannel('A').getextrema()[0] != 0: p.error('Actual transparent RGBA required')
box = im.getchannel('A').getbbox()
if not box: p.error('Empty character')
dest = ROOT/'public/assets/characters/standees'/f'{a.id}.png'
portrait = ROOT/'public/assets/portraits'/f'{a.id}.png'
source = ROOT/'docs/art-source/standees'/f'{a.id}.png'
if any(path.exists() for path in [dest, portrait, source]): p.error('Preserve existing imported art')
for path in [dest, portrait, source]: path.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(a.file, source)
# Whole figure fit into a 512px canvas, with the feet at (256,440).
figure = im.crop(box)
figure.thumbnail((360, 408), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (512,512))
canvas.paste(figure, ((512-figure.width)//2, 440-figure.height))
canvas.save(dest)
face = im.crop(tuple(a.face))
face.thumbnail((224,224), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (256,256))
canvas.paste(face, ((256-face.width)//2, 16))
canvas.save(portrait)
meta_path = ROOT/'src/data/manual/standees.json'
meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
meta[a.id] = {'file':f'characters/standees/{a.id}.png','source':str(source.relative_to(ROOT)), 'sourceSha256':hashlib.sha256(a.file.read_bytes()).hexdigest(), 'cell':[512,512], 'anchor':[256,440], 'faceCrop':a.face, 'skillTemplate':unit['skill']['template'], 'status':'static-art-runtime-motion; multi-pose-sheet-pending'}
meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
inventory = ROOT/'src/data/manual/delivered-art.json'
files = set(json.loads(inventory.read_text()))
files.update([str(dest.relative_to(ROOT/'public/assets')), str(portrait.relative_to(ROOT/'public/assets'))])
inventory.write_text(json.dumps(sorted(files),indent=2)+'\n')
print(f'{a.id}: transparent portrait + static full figure imported; no battle poses claimed')
