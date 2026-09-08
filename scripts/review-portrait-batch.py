"""Validate preserved source hashes, runtime alpha/margins and create a QA contact sheet."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('batch')
a = p.parse_args()
metadata = json.loads((ROOT / 'src/data/manual/generated-portraits.json').read_text(encoding='utf-8'))
delivered = json.loads((ROOT / 'src/data/manual/delivered-art.json').read_text(encoding='utf-8'))
ids = [key for key, value in metadata.items() if f'/{a.batch}/' in value['source']]
assert ids, 'Batch has no imported portraits'
review = Image.new('RGB', (256 * 5, 552 * ((len(ids) + 4) // 5)), '#102335')
draw = ImageDraw.Draw(review)
records = []
for i, key in enumerate(ids):
    meta = metadata[key]
    source = ROOT / meta['source']
    runtime = ROOT / 'public/assets' / meta['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == meta['sourceSha256'], key
    assert meta['file'] in delivered and (ROOT / meta['reference']).is_file(), key
    im = Image.open(runtime)
    assert im.mode == 'RGBA' and im.size == (256, 256), key
    alpha = im.getchannel('A')
    assert alpha.getextrema() == (0, 255), key
    box = alpha.getbbox()
    assert box and min(box[0], box[1], 256-box[2], 256-box[3]) >= 6, key
    x, y = i % 5 * 256, i // 5 * 552
    for offset, color in [(0, '#102335'), (256, '#f3eee0')]:
        tile = Image.new('RGBA', (256, 256), color)
        tile.alpha_composite(im)
        review.paste(tile.convert('RGB'), (x, y + offset))
    draw.text((x + 8, y + 520), key, fill='white')
    records.append({'id': key, 'sourceSha256': meta['sourceSha256'], 'runtimeSha256': hashlib.sha256(runtime.read_bytes()).hexdigest(), 'size': list(im.size), 'alphaRange': list(alpha.getextrema()), 'bbox': list(box)})
out = ROOT / 'docs/qa'
out.mkdir(parents=True, exist_ok=True)
review.save(out / f'portrait-{a.batch}-review.png')
report = {'batch': a.batch, 'count': len(ids), 'portraits': len([x for x in delivered if x.startswith('portraits/')]), 'checks': ['source hash', 'registered runtime', 'race source exists', '256x256 RGBA', 'real alpha', '6px margins'], 'records': records}
(out / f'portrait-{a.batch}-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'batch': a.batch, 'count': len(ids), 'portraits': report['portraits']}))
