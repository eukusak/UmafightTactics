"""Package an inspected transparent portrait; preserve its original and alpha."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('id')
p.add_argument('file', type=Path)
p.add_argument('--batch', default='batch-02')
a = p.parse_args()
if not a.batch.startswith('batch-') or not a.batch[6:].isdigit():
    p.error('Batch must have the form batch-03')
manifest = json.loads((ROOT / 'src/data/generated/art-manifest.json').read_text(encoding='utf-8'))
if not any(c['id'] == a.id for c in manifest['characters']):
    p.error('Unknown character')
im = Image.open(a.file)
if im.mode != 'RGBA' or im.getchannel('A').getextrema()[0] != 0 or im.getchannel('A').getextrema()[1] < 250:
    p.error('True transparent RGBA with an opaque subject required')
bbox = im.getchannel('A').getbbox()
dest = ROOT / 'public/assets/portraits' / f'{a.id}.png'
source = ROOT / 'docs/art-source/portraits' / a.batch / f'{a.id}.png'
inventory_path = ROOT / 'src/data/manual/delivered-art.json'
inventory = set(json.loads(inventory_path.read_text(encoding='utf-8')))
asset = dest.relative_to(ROOT / 'public/assets').as_posix()
if dest.exists() or source.exists() or asset in inventory:
    p.error('Existing art must be preserved')
for path in (dest, source):
    path.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(a.file, source)
figure = im.crop(bbox)
figure.thumbnail((244, 244), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (256, 256))
canvas.paste(figure, ((256 - figure.width) // 2, (256 - figure.height) // 2))
canvas.save(dest)
inventory.add(asset)
inventory_path.write_text(json.dumps(sorted(inventory), indent=2) + '\n', encoding='utf-8')
meta_path = ROOT / 'src/data/manual/generated-portraits.json'
meta = json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else {}
meta[a.id] = {
    'file': asset, 'source': source.relative_to(ROOT).as_posix(),
    'sourceSha256': hashlib.sha256(a.file.read_bytes()).hexdigest(),
    'reference': json.loads((ROOT / 'src/data/manual/reference-previews.json').read_text(encoding='utf-8'))[a.id]['source'],
    'sourceSize': list(im.size), 'crop': list(bbox), 'size': [256, 256],
    'status': 'independent-generated-static-portrait; not-rigged-model',
}
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(a.id, 'portrait imported')
