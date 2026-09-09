/** Right-click unit detail (spec §28). Never shows the UmaRogue tier. */
import { useGameStore } from '../store/gameStore';
import { getUnitDef, getUnitTraits } from '../game/engine/roster';
import { getItem } from '../game/engine/items/item-defs';
import { getTrait } from '../game/engine/traits/trait-defs';
import { RoleChip, TraitChip } from './common';
import { STAR_STAT_MULT, starSkillMultiplier, ROLE_ATTACK_MANA, ROLE_MANA_REGEN } from '../game/engine/constants';
import type { UnitInstance } from '../game/engine/state';

const DISTANCE_LABEL: Record<string, string> = {
  sprinter: '단거리', miler: '마일', middle: '중거리', stayer: '장거리',
};

export function UnitTooltip({ unit }: { unit: UnitInstance }): JSX.Element {
  const seasonId = useGameStore(s => s.match?.seasonId);
  const def = getUnitDef(unit.unitDefId);
  const mult = STAR_STAT_MULT[unit.star];
  const skillMult = starSkillMultiplier(unit.star, def.cost);
  const src = def.source;

  return (
    <>
      <h5>
        {def.nameKo} <span className="gold-text">{def.cost}코</span>{' '}
        <span className="gold-text">{'★'.repeat(unit.star)}</span>
      </h5>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <RoleChip role={def.role} />
        {getUnitTraits(def.id, seasonId).map((t) => <TraitChip key={t} id={t} />)}
      </div>
      <p className="muted">공격당 마나 {ROLE_ATTACK_MANA[def.role]}
        {ROLE_MANA_REGEN[def.role] > 0 ? ` · 초당 마나 +${ROLE_MANA_REGEN[def.role]}` : ''}
        {def.role === 'TANK' ? ' · 피격 시 마나 획득 · 같은 거리에서 우선 공격받음' : ''}
        {def.role === 'BRUISER' ? ' · 스테이지 2/3/4/5+ 공격속도 +5/10/20/30%' : ''}
      </p>

      <dl>
        <dt>체력</dt><dd>{Math.round(def.hp * mult)}</dd>
        <dt>공격력</dt><dd>{Math.round(def.attackDamage * mult)}</dd>
        <dt>주문력</dt><dd>{def.abilityPower}</dd>
        <dt>공격속도</dt><dd>{def.attackSpeed.toFixed(2)}</dd>
        <dt>방어력 / 마저</dt><dd>{def.armor} / {def.magicResist}</dd>
        <dt>사거리</dt><dd>{def.attackRange}칸</dd>
        <dt>마나</dt><dd>{def.startMana} / {def.maxMana}</dd>
        <dt>치명타</dt><dd>{Math.round(def.critChance * 100)}% ×{def.critMultiplier.toFixed(2)}</dd>
      </dl>

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #24384a' }}>
        <strong style={{ color: 'var(--cyan)' }}>{def.skill.displayName}</strong>
        <div className="muted" style={{ marginTop: 4 }}>{def.skill.description}</div>
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          스킬 배율 ×{skillMult.toFixed(2)} · 마나 {def.skill.manaCost}
        </div>
      </div>

      {unit.items.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #24384a' }}>
          {unit.items.map((id, i) => {
            const item = getItem(id);
            return (
              <div key={`${id}-${i}`} style={{ marginBottom: 5 }}>
                <strong>{item.name}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{item.description}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #24384a', fontSize: 12 }}>
        <div className="muted">실제 경주마 데이터</div>
        <dl>
          <dt>출생</dt><dd>{src.birthYear}년</dd>
          <dt>powerIndex</dt><dd>{src.powerIndex.toFixed(3)}</dd>
          <dt>대표 거리</dt><dd>{DISTANCE_LABEL[src.bestDistance] ?? src.bestDistance}</dd>
          <dt>전적</dt><dd>{src.historySummary.starts}전 {src.historySummary.wins}승</dd>
          {src.historySummary.mainWin && (<><dt>대표 승리</dt><dd>{src.historySummary.mainWin}</dd></>)}
          <dt>데이터 신뢰도</dt><dd>{src.dataConfidence}</dd>
        </dl>
      </div>
    </>
  );
}

export function traitTierLabel(id: string, count: number): string {
  const trait = getTrait(id as never);
  const reached = trait.thresholds.filter((t) => count >= t).length;
  return `${count} / ${trait.thresholds.join('·')}${reached > 0 ? ` (${reached}단계)` : ''}`;
}
