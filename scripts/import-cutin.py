"""Package inspected generated RGBA art as a 960x540 skill cut-in.
Only crop/fit/padding; preserves generated alpha, no synthesis or pose fabrication.
"""
from pathlib import Path
import argparse, hashlib, json, shutil
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('id'); p.add_argument('file', type=Path)
a = p.parse_args()
manifest = json.loads((ROOT/'src/data/generated/art-manifest.json').read_text())
if not any(c['id'] == a.id and c['cutinRequired'] for c in manifest['characters']): p.error('Not a requested cut-in')
im = Image.open(a.file)
if im.mode != 'RGBA' or im.getchannel('A').getextrema() != (0,255): p.error('Transparent RGBA required')
bbox = im.getchannel('A').getbbox()
if not bbox: p.error('Empty art')
dest = ROOT/'public/assets/characters/cutin'/f'{a.id}.png'
source = ROOT/'docs/art-source/cutins'/f'{a.id}.png'
if dest.exists() or source.exists(): p.error('Existing art must be preserved')
for path in [dest, source]: path.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(a.file, source)
figure = im.crop(bbox); figure.thumbnail((552, 516), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (960,540))
canvas.paste(figure, (948 - figure.width, 540 - figure.height))
canvas.save(dest)
assert canvas.getchannel('A').crop((0,0,384,540)).getbbox() is None
inventory = ROOT/'src/data/manual/delivered-art.json'
files = set(json.loads(inventory.read_text())); files.add(str(dest.relative_to(ROOT/'public/assets')))
inventory.write_text(json.dumps(sorted(files),indent=2)+'\n')
meta_path = ROOT/'src/data/manual/cutins.json'
meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
meta[a.id] = {'file':str(dest.relative_to(ROOT/'public/assets')), 'source':str(source.relative_to(ROOT)), 'sourceSha256':hashlib.sha256(a.file.read_bytes()).hexdigest(), 'size':[960,540], 'leftClearPixels':384, 'status':'static-skill-illustration; not-rigged-model'}
meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(a.id, 'cut-in imported')
