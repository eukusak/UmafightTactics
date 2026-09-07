"""Crop reference thumbnails; these are previews, never delivered character art.
Requires Pillow. Only exact normalized English-name matches are permitted.
"""
import json, re
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'
units = json.loads((ROOT / 'src/data/generated/all-units.json').read_text())['units']
refs = json.loads((ASSETS / 'characters/race/manifest.json').read_text())['characters']
def key(name):
    return re.sub('[^a-z0-9]', '', name.lower())
by_name = {key(r['character_name']): r for r in refs}
output = ASSETS / 'characters/reference_previews'
output.mkdir(exist_ok=True)
result = {}
for unit in units:
    ref = by_name.get(key(unit['nameEn']))
    if ref is None:
        continue
    with Image.open(ROOT / ref['path']) as image:
        w, h = image.size
        # Two inspected turnaround layouts: 8 views + details, or 7 views.
        if abs(w / h - 2.5) < .01:
            cx, max_y = .4175 * w, .5 * h
        elif abs(w / h - 4.0) < .01:
            cx, max_y = .3575 * w, h
        else:
            raise ValueError(f'Unreviewed reference layout: {ref["file_name"]}')
        # Measure the front figure's height within a narrow, isolated centre
        # strip. Short characters must not be cropped using tall-character y.
        small=image.resize((1000, round(h / w * 1000))).convert('RGB')
        sx=round(cx / w * 1000); bottom=round(max_y / w * 1000)
        bg=small.getpixel((0,0)); rows=[]
        for y in range(bottom):
            if any(max(abs(small.getpixel((x,y))[c]-bg[c]) for c in range(3)) > 26 for x in range(sx-30,sx+31)):
                rows.append(y)
        if not rows: raise ValueError(f'No foreground in reference: {ref["file_name"]}')
        top_y=rows[0] * w / 1000; body_h=(rows[-1]-rows[0]+1) * w / 1000
        side=body_h * .43; top_y-=body_h * .045
        box=(round(cx-side/2),round(top_y),round(cx+side/2),round(top_y+side))
        image.crop(box).resize((256, 256), Image.Resampling.LANCZOS).save(output / f"{unit['id']}.png")
    result[unit['id']] = {'preview': f"characters/reference_previews/{unit['id']}.png", 'source': ref['path'], 'sourceSha256': ref['sha256'], 'status': 'reference-preview-only'}
(ROOT / 'src/data/manual/reference-previews.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'{len(result)} reference previews; missing: ' + ', '.join(u['id'] for u in units if u['id'] not in result))
