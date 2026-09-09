"""Crop, uniformly scale, and atlas-pack reviewed AI frames. Never remove backgrounds."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/art-source/motions/batch-01'
briefs = {u['id']: u for u in json.loads((ROOT / 'docs/art-source/motions/briefs.json').read_text(encoding='utf-8'))['units']}
reviews = {
    'special_week': '사거리 3의 손짓 발사. 직선 돌파: 웅크린 출발 → 전방 발진 → 낮은 돌진 → 착지. 마법 구체 시전 포즈를 사용하지 않음.',
    'training_dummy': '장갑 펀치와 몸을 낮춘 충전 → 두 장갑 들기 → 광역 반격 방출 → 기본 자세.',
    'track_golem': '바위 팔 타격과 몸을 낮춘 충전 → 양팔 들기 → 힘 방출 → 자세 회복.',
    'supply_robot': '원거리 집게 발사와 양팔 충전 → 전방 광역 반격 방출. 실제 스킬에 없는 치유/보급 효과를 추가하지 않음.',
    'trophy_guardian': '원거리 주먹 발사, 방패를 든 채 힘 모으기 → 팔을 들어 광역 반격 방출. 방패 외형을 무적 스킬로 해석하지 않음.',
    'grand_trophy_guardian': '대형 왕관/망토를 유지한 공격과 양팔 충전 → 광역 반격 방출 → 회복.',
}

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def cuts(projection, count):
    size = len(projection)
    result = [0]
    for i in range(1, count):
        nominal = round(size * i / count)
        lo, hi = max(result[-1] + 100, nominal - 70), min(size, nominal + 70)
        result.append(min(range(lo, hi), key=lambda x: (projection[x], abs(x - nominal))))
    return result + [size]

def split(file):
    im = Image.open(file)
    assert im.mode == 'RGBA', f'{file}: missing generated alpha'
    alpha = im.getchannel('A')
    assert alpha.histogram()[0] > im.width * im.height * .3, f'{file}: painted background'
    solid = alpha.point(lambda a: 255 if a >= 200 else 0)
    ys = cuts([sum(solid.crop((0, y, im.width, y + 1)).histogram()[1:]) for y in range(im.height)], 6)
    frames = []
    for row in range(6):
        strip = solid.crop((0, ys[row], im.width, ys[row + 1]))
        xs = cuts([sum(strip.crop((x, 0, x + 1, strip.height)).histogram()[1:]) for x in range(im.width)], 4)
        for col in range(4):
            cell = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            bbox = solid.crop(cell).getbbox()
            assert bbox, (file, row, col)
            crop = (max(cell[0], cell[0] + bbox[0] - 3), max(cell[1], cell[1] + bbox[1] - 3), min(cell[2], cell[0] + bbox[2] + 3), min(cell[3], cell[1] + bbox[3] + 3))
            frames.append((im.crop(crop), {'source': file.relative_to(ROOT).as_posix(), 'sourceSha256': digest(file), 'crop': crop}))
    return frames

registry = json.loads((ROOT / 'src/data/manual/frame-sheets.json').read_text(encoding='utf-8'))
runtime = ROOT / 'public/assets/motions'
runtime.mkdir(parents=True, exist_ok=True)
for name, review in reviews.items():
    unit_id = name if name == 'special_week' else 'pve_' + name
    frames = split(SOURCE / name / 'spaced-transparent.png')
    if name == 'special_week':
        base = split(SOURCE / name / 'base-transparent.png')
        # The skill edit changed unrelated KO/victory rows. Keep their approved earlier drawings.
        # Match the preserved source's camera scale to the newly spaced source using idle height.
        normalization = frames[0][0].height / base[0][0].height
        preserved = [(im.resize((round(im.width * normalization), round(im.height * normalization)), Image.Resampling.LANCZOS), {**record, 'sourceNormalization': normalization}) for im, record in base[16:24]]
        frames = frames[:16] + preserved
    scale = min(110 / max(im.width for im, _ in frames), 104 / max(im.height for im, _ in frames))
    atlas = Image.new('RGBA', (512, 768), (0, 0, 0, 0))
    packed = []
    for i, (im, record) in enumerate(frames):
        size = (round(im.width * scale), round(im.height * scale))
        resized = im.resize(size, Image.Resampling.LANCZOS)
        xy = ((i % 4) * 128 + (128 - size[0]) // 2, (i // 4) * 128 + 110 - size[1])
        atlas.alpha_composite(resized, xy)
        packed.append({**record, 'frame': i, 'destination': [*xy, *size]})
    dest = runtime / f'{unit_id}.png'
    atlas.save(dest)
    record_path = SOURCE / name / 'packing.json'
    record_path.write_text(json.dumps({'format': 'uft-baked-frames-v1', 'scale': scale, 'anchor': [64, 110], 'runtimeSha256': digest(dest), 'frames': packed}, indent=2) + '\n', encoding='utf-8')
    registry[unit_id] = {'file': f'motions/{unit_id}.png', 'frameWidth': 128, 'frameHeight': 128, 'columns': 4, 'rows': 6, 'source': record_path.relative_to(ROOT).as_posix(), 'skillId': briefs[unit_id]['skill']['id'], 'skillSignature': briefs[unit_id]['skillSignature'], 'skillReview': review}
    print(unit_id, '24 frames', 'scale', round(scale, 3))
(ROOT / 'src/data/manual/frame-sheets.json').write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
inventory = ROOT / 'src/data/manual/delivered-art.json'
files = {p for p in json.loads(inventory.read_text(encoding='utf-8')) if not p.startswith('rigs/')}
files.update(r['file'] for r in registry.values())
inventory.write_text(json.dumps(sorted(files), indent=2) + '\n', encoding='utf-8')
