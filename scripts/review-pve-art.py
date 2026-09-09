"""Check generated PvE cutouts and their grounded runtime placement."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
metadata = json.loads((root / 'src/data/manual/generated-pve.json').read_text(encoding='utf-8'))
delivered = json.loads((root / 'src/data/manual/delivered-art.json').read_text(encoding='utf-8'))
review = Image.new('RGB', (1280, 552), '#102335')
draw = ImageDraw.Draw(review)
records = []
for i, (key, meta) in enumerate(sorted(metadata.items())):
    for kind in ('source', 'runtime'):
        file = root / meta[kind]
        assert hashlib.sha256(file.read_bytes()).hexdigest() == meta[kind + 'Sha256'], key
    im = Image.open(root / meta['runtime'])
    assert im.mode == 'RGBA' and im.size == (512, 512), key
    assert im.getchannel('A').getextrema() == (0, 255), key
    box = im.getchannel('A').getbbox()
    assert box and box[3] <= 440 and min(box[0], box[1], 512 - box[2]) >= 56, key
    assert meta['runtime'].removeprefix('public/assets/') in delivered, key
    thumbnail = im.resize((256, 256), Image.Resampling.LANCZOS)
    for y, color in ((0, '#102335'), (256, '#f3eee0')):
        tile = Image.new('RGBA', (256, 256), color)
        tile.alpha_composite(thumbnail)
        review.paste(tile.convert('RGB'), (i * 256, y))
    draw.text((i * 256 + 8, 520), key, fill='white')
    records.append({'id': key, 'bbox': list(box), 'sourceSha256': meta['sourceSha256'], 'runtimeSha256': meta['runtimeSha256']})
review.save(root / 'docs/qa/pve-standees-review.png')
report = {'count': len(records), 'checks': ['preserved source and runtime SHA256', '512x512 RGBA', 'real transparency', 'grounded at y=440', 'registered runtime'], 'actualCubismModels': 0, 'records': records}
(root / 'docs/qa/pve-standees-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'count': len(records), 'checks': 'passed'}))
