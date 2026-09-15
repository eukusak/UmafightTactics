import raceArtCatalog from '../src/data/manual/race-art.json';
/**
 * Verifies delivered art against art-manifest.json (spec §38).
 *
 * Normal runs report what is missing and exit 0, because the game ships with
 * procedural fallbacks and must stay playable with zero PNGs. `STRICT_ART=1`
 * makes any missing or malformed asset a failure — that is the design-delivery
 * acceptance gate.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCompletePng } from './validate-png';
import type { ArtManifest } from '../src/game/engine/types';
import { FRAME_SHEETS } from '../src/game/ui/frame-animation';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const MANIFEST = path.join(ROOT, 'src', 'data', 'generated', 'art-manifest.json');

const STRICT = process.env.STRICT_ART === '1';

/**
 * Commissioned but undelivered art.
 *
 * A roster change and its artwork cannot land in the same commit — the units
 * have to exist before anyone can draw them. Listed paths are reported as
 * outstanding rather than failing the strict run, and the list is self-cleaning:
 * a listed file that actually exists fails the check, so an exemption cannot
 * outlive the delivery it was waiting for.
 */
const pendingArt = JSON.parse(
  readFileSync(path.join(ROOT, 'src', 'data', 'manual', 'pending-art.json'), 'utf8'),
) as { pending: Array<{ path: string; request: string; reason: string }> };
const pendingPaths = new Map(pendingArt.pending.map((p) => [p.path, p]));

type Check = { rel: string; label: string; priority: 'P0' | 'P1'; expect?: { w: number; h: number } };

/** Reads width/height straight from the PNG IHDR chunk. */
function pngSize(file: string): { w: number; h: number } | null {
  try {
    const buf = readFileSync(file);
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buf.length < 33 || !buf.subarray(0, 8).equals(signature)) return null;
    if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

/** PNG colour type 6 is RGBA; 4 is grey+alpha. Both carry an alpha channel. */
function pngHasAlpha(file: string): boolean {
  try {
    const buf = readFileSync(file);
    const colourType = buf.readUInt8(25);
    return colourType === 6 || colourType === 4 || (colourType === 3 && buf.includes(Buffer.from('tRNS')));
  } catch {
    return false;
  }
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as ArtManifest;
const checks: Check[] = [];

for (const c of manifest.characters) {
  const priority = c.activeS1 ? 'P0' : 'P1';
  checks.push({ rel: c.portrait, label: `초상화 ${c.nameKo}`, priority, expect: { w: 256, h: 256 } });
  const frames = FRAME_SHEETS[c.id];
  checks.push({ rel: frames?.file ?? c.battleSheet, label: `전투시트 ${c.nameKo}`, priority,
    expect: frames ? { w: frames.frameWidth * frames.columns, h: frames.frameHeight * frames.rows } : { w: 1280, h: 768 } });
  if (c.cutinRequired) {
    checks.push({
      rel: `characters/cutin/${c.id}.png`, label: `컷인 ${c.nameKo}`,
      priority: 'P0', expect: { w: 960, h: 540 },
    });
  }
}
for (const rel of manifest.items) checks.push({ rel, label: '아이템', priority: 'P0', expect: { w: 96, h: 96 } });
for (const rel of manifest.traits) checks.push({ rel, label: '특성', priority: 'P0', expect: { w: 96, h: 96 } });
for (const rel of manifest.augments) checks.push({ rel, label: '증강', priority: 'P0', expect: { w: 96, h: 96 } });
for (const rel of manifest.status) checks.push({ rel, label: '상태', priority: 'P0', expect: { w: 96, h: 96 } });
for (const rel of manifest.vfx) checks.push({ rel, label: 'VFX', priority: 'P0', expect: { w: 1920, h: 192 } });
for (const a of raceArtCatalog.filter(a => !a.file.startsWith('vfx/'))) {
  checks.push({ rel: a.file, label:'레이스 아트', priority:'P0', expect:{w:a.w*a.cols,h:a.h*a.rows} });
}
for (const rel of manifest.starVfx) checks.push({ rel, label: '별 VFX', priority: 'P0', expect: { w: 1536, h: 512 } });
for (const rel of manifest.pve) {
  const frames = FRAME_SHEETS[`pve_${path.basename(rel, '.png')}`];
  checks.push({ rel: frames?.file ?? rel, label: 'PvE', priority: 'P0',
    expect: frames ? { w: frames.frameWidth * frames.columns, h: frames.frameHeight * frames.rows } : { w: 1280, h: 512 } });
}
for (const rel of manifest.boards) checks.push({ rel, label: '배경', priority: 'P0', expect: { w: 1920, h: 1080 } });
for (const rel of manifest.banners) checks.push({ rel, label: '배너', priority: 'P0', expect: { w: 960, h: 180 } });
checks.push({ rel: 'ui/board_hex_tiles.png', label: 'Hex 타일', priority: 'P0', expect: { w: 768, h: 96 } });
checks.push({ rel: 'ui/ui_frames.png', label: 'UI 프레임', priority: 'P0', expect: { w: 384, h: 192 } });
checks.push({ rel: 'ui/ui_slots.png', label: '슬롯/카드', priority: 'P0', expect: { w: 1536, h: 512 } });

const missing = { P0: [] as string[], P1: [] as string[] };
const pendingSeen: string[] = [];
const pendingButDelivered: string[] = [];
const malformed: string[] = [];
let present = 0;

for (const check of checks) {
  const file = path.join(ASSETS, check.rel);
  if (!existsSync(file) || statSync(file).size === 0) {
    if (pendingPaths.has(check.rel)) pendingSeen.push(`${check.label} — ${check.rel}`);
    else missing[check.priority].push(`${check.label} — ${check.rel}`);
    continue;
  }
  if (pendingPaths.has(check.rel)) pendingButDelivered.push(check.rel);
  present += 1;
  const size = pngSize(file);
  if (!size) {
    malformed.push(`${check.rel}: PNG 헤더를 읽을 수 없음`);
    continue;
  }
  if (check.expect && (size.w !== check.expect.w || size.h !== check.expect.h)) {
    malformed.push(
      `${check.rel}: ${size.w}×${size.h} (기대 ${check.expect.w}×${check.expect.h})`,
    );
  }
  if (check.rel.startsWith('boards/') || raceArtCatalog.some(a => a.file === check.rel)) {
    try {
      await assertCompletePng(file);
    } catch (error) {
      malformed.push(check.rel + ': PNG 전체 디코딩 실패 (' + String(error) + ')');
    }
  }
  // Backgrounds are the only assets allowed to be opaque.
  const needsAlpha = !check.rel.startsWith('boards/');
  if (needsAlpha && !pngHasAlpha(file)) malformed.push(`${check.rel}: 알파 채널 없음 (RGBA 필요)`);
}

const total = checks.length;
console.log(`check:art — ${present}/${total} 자산 확인됨`);
console.log(`  P0 누락 ${missing.P0.length}건 / P1 누락 ${missing.P1.length}건 / 규격 불일치 ${malformed.length}건`);

const preview = (list: string[], n = 8): void => {
  for (const item of list.slice(0, n)) console.log(`    - ${item}`);
  if (list.length > n) console.log(`    … 외 ${list.length - n}건`);
};

if (pendingSeen.length) {
  console.log(`\n  [발주 대기] 발주서에 올라가 있으나 아직 납품되지 않은 자산 ${pendingSeen.length}건:`);
  preview(pendingSeen, 12);
  for (const entry of new Set(pendingArt.pending.map((p) => p.request))) console.log(`    발주서: ${entry}`);
}
if (pendingButDelivered.length) {
  console.log('\n  [정리 필요] 납품이 끝났는데 pending-art.json에 남아 있는 자산:');
  preview(pendingButDelivered, 12);
}
if (missing.P0.length) { console.log('\n  [P0] Season 1 플레이에 필요한 누락 자산:'); preview(missing.P0); }
if (missing.P1.length) { console.log('\n  [P1] 도감 전용 누락 자산:'); preview(missing.P1); }
if (malformed.length) { console.log('\n  [규격] 잘못된 자산:'); preview(malformed); }

if (!STRICT) {
  console.log(
    '\ncheck:art — OK (비엄격 모드). 누락 자산은 절차적 fallback으로 대체되어 게임은 완주 가능합니다.',
  );
  console.log('  전체 납품 검수는 `STRICT_ART=1 npm run check:art`로 실행하세요.');
  process.exit(0);
}

if (missing.P0.length || missing.P1.length || malformed.length || pendingButDelivered.length) {
  if (pendingButDelivered.length) {
    console.error('\ncheck:art FAILED — 납품이 끝난 자산이 pending-art.json에 남아 있습니다. 목록에서 지우세요.');
  } else {
    console.error('\ncheck:art FAILED — STRICT_ART=1 에서는 모든 자산이 규격에 맞게 존재해야 합니다.');
  }
  process.exit(1);
}
if (pendingSeen.length) {
  console.log(`\ncheck:art — OK (엄격 모드). 발주 대기 ${pendingSeen.length}건을 제외한 전체 납품 조건을 만족합니다.`);
} else {
  console.log('\ncheck:art — OK (엄격 모드). 전체 납품 조건을 만족합니다.');
}
