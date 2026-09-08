import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ALL_UNITS, getUnitDef } from '../src/game/engine/roster';
import { PVE_UNIT_IDS } from '../src/game/engine/battle/pve-units';
import type { SkillTemplate } from '../src/game/engine/types';
import previews from '../src/data/manual/reference-previews.json';
import { FRAME_SHEETS } from '../src/game/ui/frame-animation';

const poses: Record<SkillTemplate, string[]> = {
  DASH_LINE: ['낮게 웅크린 출발', '대상을 향한 전방 발진', '몸을 낮춘 직선 돌파', '착지하며 자세 회복'],
  AOE_BURST: ['힘을 모으는 자세', '팔과 중심을 들어 충전', '광역 에너지 방출', '팔을 내리며 회복'],
  SINGLE_EXECUTE: ['단일 대상 조준', '집중하며 몸을 당김', '결정타 방출', '무게중심 회복'],
  SHIELD_TAUNT: ['방어 자세 준비', '팔을 들어 방벽 전개', '정면을 막으며 도발', '방어 유지'],
  HEAL_BUFF: ['아군을 향해 손 모음', '손바닥을 열어 회복 준비', '아군 방향으로 회복 기운 전달', '격려하며 회복'],
  BACKLINE_DIVE: ['뒷줄을 바라보며 도약 준비', '몸을 띄워 진입', '목표 방향으로 내려찍기', '낮은 착지'],
  MULTI_SHOT: ['다중 표적 조준', '발사 자세 당김', '여러 방향으로 연속 방출', '반동 회복'],
  CONE: ['상체를 비틀어 준비', '부채꼴 첫 방향 겨냥', '전방을 넓게 휩쓸기', '팔을 거두며 회복'],
  AURA: ['몸 중심에 기운 모음', '팔을 벌려 확장', '오라를 펼쳐 유지', '오라를 유지하며 기본 자세'],
  CONTROL: ['대상 지점 조준', '제어 기운 응축', '대상에 구속 명령', '손을 거두며 회복'],
  RAMP: ['힘을 모으며 자세 낮춤', '몸에 힘을 실어 일어남', '강화된 자세로 힘 과시', '강화 자세 유지'],
  SUMMON: ['소환 지점 지정', '손을 들어 호출', '지점을 향해 소환 명령', '소환체를 지휘하는 자세'],
};

const units = [...ALL_UNITS, ...Object.values(PVE_UNIT_IDS).map(getUnitDef)];
const briefs = units.map(u => {
  const sheet = FRAME_SHEETS[u.id];
  const signature = createHash('sha256').update(JSON.stringify(u.skill)).digest('hex');
  return {
    id: u.id, name: u.nameKo,
    reference: u.id.startsWith('pve_') ? `public/assets/pve/standees/${u.id.slice(4)}.png` : (previews as Record<string, { source?: string }>)[u.id]?.source ?? `public/assets/portraits/${u.id}.png`,
    skill: u.skill, skillSignature: signature,
    basicAttack: u.attackRange > 1 ? '원거리 조준 → 발사 준비 → 투사체 방출 → 반동 회복' : '근접 준비 → 당김 → 타격 → 회수',
    skillPoseDraft: poses[u.skill.template],
    productionRule: '이 초안은 제작 완료가 아니다. 원본 -Race.png의 의상·머리·장식과 이 캐릭터의 실제 효과/대상/이동을 함께 검토하여 개별 원화를 생성하고 검수한다. 존재하지 않는 치유·소환·무기를 추가하지 않는다.',
    status: !sheet ? 'PENDING_ART' : sheet.skillSignature === signature ? 'REVIEWED_FRAMES' : 'SKILL_CHANGED_REVIEW_REQUIRED',
    reviewedPoses: sheet?.skillReview ?? null,
  };
});
mkdirSync('docs/art-source/motions', { recursive: true });
writeFileSync('docs/art-source/motions/briefs.json', JSON.stringify({ format: 'uft-motion-brief-v1', units: briefs }, null, 2) + '\n');
console.log(`Motion briefs: ${briefs.length}; reviewed ${briefs.filter(b => b.status === 'REVIEWED_FRAMES').length}; remaining ${briefs.filter(b => b.status !== 'REVIEWED_FRAMES').length}`);
