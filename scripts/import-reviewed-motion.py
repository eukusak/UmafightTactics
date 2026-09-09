"""Pack an individually reviewed atlas. Generated alpha is preserved, never synthesized."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION = ROOT / 'docs/art-source/motions/production-144'


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def boundaries(projection, count):
    size = len(projection)
    edges = [0]
    for i in range(1, count):
        nominal = round(size * i / count)
        candidates = range(max(edges[-1] + 100, nominal - 70), min(size, nominal + 70))
        edges.append(min(candidates, key=lambda x: (projection[x], abs(x - nominal))))
    return edges + [size]


def pack(unit_id):
    directory = PRODUCTION / unit_id
    review = json.loads((directory / 'review.json').read_text(encoding='utf-8'))
    generation = json.loads((directory / 'generation.json').read_text(encoding='utf-8'))
    assert review['approved'] is True, f'{unit_id}: needs visual review'
    briefs = json.loads((ROOT / 'docs/art-source/motions/briefs.json').read_text(encoding='utf-8'))['units']
    brief = next(u for u in briefs if u['id'] == unit_id)
    if generation['skillSignature'] != brief['skillSignature']:
        # Original generation provenance stays immutable after a compatible
        # timing/effect review. Only that exact, recorded skill revision may pack.
        registry = json.loads((ROOT / 'src/data/manual/frame-sheets.json').read_text(encoding='utf-8'))
        review_path = registry.get(unit_id, {}).get('skillCompatibilityReview')
        assert review_path, 'Skill changed since generation; needs motion review'
        compatibility = json.loads((ROOT / review_path).read_text(encoding='utf-8'))['units'][unit_id]
        assert compatibility['originalSkillSignature'] == generation['skillSignature']
        assert compatibility['skillSignature'] == brief['skillSignature'], 'Skill changed since compatibility review'
    source = directory / review['source']
    assert source.resolve().is_relative_to(directory.resolve()), 'Source must stay in character directory'
    im = Image.open(source)
    assert im.mode == 'RGBA' and im.size == (1024, 1536), 'Expected a generated 1024x1536 RGBA atlas'
    alpha = im.getchannel('A')
    assert alpha.histogram()[0] > im.width * im.height * .3, 'Background is not transparent'
    # Include translucent hair edges and effects when locating cell gaps.
    # This mask only chooses crop bounds; the original alpha is preserved.
    solid = alpha.point(lambda a: 255 if a >= 16 else 0)
    ys = boundaries([sum(solid.crop((0, y, im.width, y + 1)).histogram()[1:]) for y in range(im.height)], 6)
    frames = []
    for row in range(6):
        strip = solid.crop((0, ys[row], im.width, ys[row + 1]))
        xs = boundaries([sum(strip.crop((x, 0, x + 1, strip.height)).histogram()[1:]) for x in range(im.width)], 4)
        for col in range(4):
            cell = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            box = solid.crop(cell).getbbox()
            assert box, f'Missing frame {row * 4 + col}'
            crop = (max(cell[0], cell[0] + box[0] - 3), max(cell[1], cell[1] + box[1] - 3), min(cell[2], cell[0] + box[2] + 3), min(cell[3], cell[1] + box[3] + 3))
            frames.append((im.crop(crop), crop))
    order = review.get('frameOrder', list(range(24)))
    assert sorted(order) == list(range(24)), 'Every source pose must be accounted for exactly once'
    frames = [frames[i] for i in order]
    scale = min(110 / max(frame.width for frame, _ in frames), 104 / max(frame.height for frame, _ in frames))
    atlas = Image.new('RGBA', (512, 768), (0, 0, 0, 0))
    records = []
    for i, (frame, crop) in enumerate(frames):
        size = (round(frame.width * scale), round(frame.height * scale))
        xy = ((i % 4) * 128 + (128 - size[0]) // 2, (i // 4) * 128 + 110 - size[1])
        atlas.alpha_composite(frame.resize(size, Image.Resampling.LANCZOS), xy)
        records.append({'frame': i, 'sourceFrame': order[i], 'source': source.relative_to(ROOT).as_posix(), 'sourceSha256': sha(source), 'crop': crop, 'destination': [*xy, *size]})
    dest = ROOT / 'public/assets/motions' / f'{unit_id}.png'
    atlas.save(dest)
    packing = directory / 'packing.json'
    packing.write_text(json.dumps({'format': 'uft-baked-frames-v1', 'scale': scale, 'anchor': [64, 110], 'runtimeSha256': sha(dest), 'frames': records}, indent=2) + '\n', encoding='utf-8')
    registry_file = ROOT / 'src/data/manual/frame-sheets.json'
    registry = json.loads(registry_file.read_text(encoding='utf-8'))
    compatibility_path = registry.get(unit_id, {}).get('skillCompatibilityReview')
    registry[unit_id] = {'file': f'motions/{unit_id}.png', 'frameWidth': 128, 'frameHeight': 128, 'columns': 4, 'rows': 6, 'source': packing.relative_to(ROOT).as_posix(), 'skillId': brief['skill']['id'], 'skillSignature': brief['skillSignature'], 'skillReview': review['skillReview'], 'skillReleaseFrame': generation['skillReleaseFrame']}
    if compatibility_path:
        registry[unit_id]['skillCompatibilityReview'] = compatibility_path
    registry_file.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    inventory_file = ROOT / 'src/data/manual/delivered-art.json'
    inventory = set(json.loads(inventory_file.read_text(encoding='utf-8')))
    inventory.add(f'motions/{unit_id}.png')
    inventory_file.write_text(json.dumps(sorted(inventory), indent=2) + '\n', encoding='utf-8')
    generation['status'] = 'REVIEWED_PACKED'
    generation['runtimeFile'] = dest.relative_to(ROOT).as_posix()
    generation['runtimeSha256'] = sha(dest)
    (directory / 'generation.json').write_text(json.dumps(generation, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(unit_id, '24 reviewed poses packed')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('ids', nargs='+')
    args = parser.parse_args()
    for unit_id in args.ids:
        assert '/' not in unit_id and '\\' not in unit_id and '..' not in unit_id
        pack(unit_id)
