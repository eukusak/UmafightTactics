import type { Cost, EffectDef, SkillDef, Star } from '../game/engine/types';
import { skillEffectValue } from '../game/engine/battle/skill-scaling';

const labels: Partial<Record<EffectDef['kind'], string>> = {
  DAMAGE: '피해', DAMAGE_MAXHP_PCT: '최대 체력 피해', HEAL: '회복', SHIELD_FLAT: '보호막',
  HEAL_MAXHP_PCT: '최대 체력 회복', HEAL_MISSING_PCT: '잃은 체력 회복', SHIELD_MAXHP_PCT: '최대 체력 보호막',
  STAT_ADD: '능력치', STAT_MUL: '능력치', STACKING_STAT: '중첩당', MANA_ADD: '마나 회복', MANA_DRAIN: '마나 제거',
  DAMAGE_REDUCTION: '받는 피해 감소', SUNDER_ARMOR_PCT: '방어력 감소', SHRED_MR_PCT: '마저 감소', SUMMON: '소환 체력',
};
const stats: Record<string, string> = { hp: '체력', attackDamage: '공격력', abilityPower: '주문력', armor: '방어력', magicResist: '마저', attackSpeed: '공속' };
const percentages = new Set(['DAMAGE_MAXHP_PCT', 'HEAL_MAXHP_PCT', 'HEAL_MISSING_PCT', 'SHIELD_MAXHP_PCT', 'STAT_MUL', 'DAMAGE_REDUCTION', 'SUNDER_ARMOR_PCT', 'SHRED_MR_PCT']);

export function SkillValues({ skill, cost, star = 1, abilityPower = 100 }: { skill: SkillDef; cost: Cost; star?: Star; abilityPower?: number }): JSX.Element {
  const rows = new Map<string, { effect: EffectDef; count: number }>();
  for (const effect of skill.effects) {
    if (!labels[effect.kind] || effect.value === undefined) continue;
    const keyEffect = { ...effect };
    delete keyEffect.delay;
    const key = JSON.stringify(keyEffect);
    const row = rows.get(key) ?? { effect, count: 0 };
    row.count += effect.tag?.startsWith('REPEAT:') ? Number(effect.tag.slice(7)) || 1 : 1;
    rows.set(key, row);
  }
  return <div className="skill-values">
    <strong>성급별 스킬 수치 · 현재 {star}성</strong>
    <table aria-label="성급별 스킬 수치"><thead><tr><th scope="col">효과</th>{([1, 2, 3] as Star[]).map(s => <th key={s} scope="col" data-current={s === star}>{s}성</th>)}</tr></thead>
      <tbody>{[...rows].map(([key, { effect, count }]) => <tr key={key}>
        <th scope="row">{effect.stat ? (stats[effect.stat] ?? effect.stat) + (effect.kind === 'STACKING_STAT' ? ' 중첩당' : '') : labels[effect.kind]}{count > 1 ? ' ×' + count + '회' : ''}</th>
        {([1, 2, 3] as Star[]).map(s => {
          const percent = percentages.has(effect.kind) || effect.tag === 'PCT' || effect.tag === 'MAX_MANA_FRACTION';
          const value = skillEffectValue(effect, s, cost, abilityPower)! * (percent ? 100 : 1);
          return <td key={s} data-current={s === star}>{Number(value.toFixed(percent ? 1 : 0))}{percent ? '%' : ''}</td>;
        })}
      </tr>)}</tbody>
    </table>
    <p className="muted">주문력 {Math.round(abilityPower)} 기준 · 대상당 1회 수치. 방어력·치명타·특성 증폭·회복 감소 적용 전입니다. 제어 시간과 범위는 동일합니다.</p>
  </div>;
}
