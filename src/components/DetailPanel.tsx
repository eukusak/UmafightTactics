import { EffectDescription } from './EffectDescription';
import { useWishlistStore } from '../store/wishlistStore';
import { SkillValues } from './SkillValues';
import { matchSkillDescription, matchItemDescription } from '../game/ui/match-descriptions';
import { getAugment } from '../game/engine/augments/augment-defs';
import { BattleRecap } from './BattleRecap';
import { useGameStore } from '../store/gameStore';
import { useInteractionStore } from '../store/interactionStore';
import { getUnitDef, getUnitTraits, getSeasonUnits } from '../game/engine/roster';
import { COMPLETED_ITEM_DEFS, getItem } from '../game/engine/items/item-defs';
import { getTrait, activeTierIndex } from '../game/engine/traits/trait-defs';
import { activeTraitCounts } from '../game/engine/ai';
import { buildBaseStats } from '../game/engine/battle/combat-unit';
import { sellPrice } from '../game/engine/shop';
import { frameAt } from '../game/ui/battle-playback';
import { ItemIcon, Portrait, RoleChip } from './common';
import type { TraitId } from '../game/engine/types';

function ItemLink({ id, playerId }: { id: string; playerId?: string }): JSX.Element {
  const owner = useGameStore(s => playerId ? s.match?.players.find(p=>p.id===playerId) : s.human());
  return <button className="detail-item-link" onClick={() => useInteractionStore.getState().inspect({ kind: 'item', id, playerId: owner?.id })}>
    <ItemIcon itemId={id} size={28} title={matchItemDescription(id, owner ?? undefined).description} /><span>{getItem(id).name}</span>
  </button>;
}

function ItemDetail({ id, playerId }: { id: string; playerId?: string }): JSX.Element {
  const owner = useGameStore(s => playerId ? s.match?.players.find(p=>p.id===playerId) : s.human());
  const effective = matchItemDescription(id, owner ?? undefined);
  const item = getItem(id);
  const recipes = COMPLETED_ITEM_DEFS.filter(i => i.components?.includes(id));
  return <>
    <div className="detail-heading"><ItemIcon itemId={id} size={46} title={effective.description} /><h3>{item.name}</h3></div>
    <span className="pill">{item.tier === 'ARTIFACT' ? '유물 · 4-7 승리 보상' : item.tier === 'RADIANT' ? '찬란한 장비 · 증강 보상' : item.isComponent ? '하위 아이템 · 조합 재료' : item.tactician ? '전략가 장비' : '완성 아이템'}</span>
    <p className="match-item-description"><EffectDescription text={effective.description} /></p>
    {item.unique && <p className="gold-text">중복 장착 불가</p>}
    {item.uniqueGroup && <p className="gold-text">동일 계열 장비와 중복 장착 불가 · 일반/찬란한 버전 포함</p>}
    {item.components && <><h4>조합식</h4><div className="detail-recipe">{item.components.map((id, i) => <div key={i}>{i > 0 && <b>＋</b>}<ItemLink id={id} playerId={owner?.id} /></div>)}</div></>}
    {item.isComponent && <><h4>만들 수 있는 아이템 · {recipes.length}종</h4><p className="muted">함께 필요한 재료와 완성 효과입니다. 이름을 누르면 상세 설명을 확인합니다.</p>
      {recipes.map(recipe => {
        const pair = [...recipe.components!]; pair.splice(pair.indexOf(id), 1);
        return <div className="detail-recipe-card" key={recipe.id}><div className="detail-recipe"><b>＋</b><ItemLink id={pair[0]} playerId={owner?.id} /></div><ItemLink id={recipe.id} playerId={owner?.id} /><p className="match-item-description"><EffectDescription text={matchItemDescription(recipe.id, owner ?? undefined).description} /></p></div>;
      })}</>}
    <p className="muted">보관함의 재료끼리 0.7초간 겹쳐 유지하면 조합됩니다. 재료를 기물 위로 드래그하면 장착됩니다. 이미 장착한 재료와 조합할 수 있으면 자동 완성됩니다.</p>
  </>;
}

function TraitDetail({ id, playerId }: { id: TraitId; playerId: string }): JSX.Element | null {
  const wishlist=useWishlistStore(s=>s.wishlist),toggle=useWishlistStore(s=>s.toggle);
  const player = useGameStore.getState().match?.players.find(p => p.id === playerId);
  if (!player) return null;
  const trait = getTrait(id), count = activeTraitCounts(player, player.board).get(id) ?? 0;
  const tier = activeTierIndex(trait, count);
  const members = getSeasonUnits(player.seasonId).filter(u => getUnitTraits(u.id, player.seasonId).includes(id)).sort((a,b)=>a.cost-b.cost||a.nameKo.localeCompare(b.nameKo));
  const finalCount = trait.thresholds.at(-1)!;
  const shortage = Math.max(0, finalCount - members.length);
  return <><h3>{trait.name}</h3><p><EffectDescription text={trait.description} /></p><strong className="gold-text">{player.name} · 배치 {count}명</strong>
    <p className="muted">같은 기물은 한 번만 집계하며 대기석은 제외합니다.</p>
    <p className="trait-chase-note">총 {trait.tiers.length}단계 · 최종 {finalCount}명 · 이번 시즌 기본 보유 {members.length}명
      {shortage > 0 ? ` · 상징 또는 특성 추가로 최소 ${shortage}명 보강 필요` : finalCount >= 8 ? ' · 높은 레벨 또는 편성 인원 증가가 필요한 최종 조합' : ''}</p>
    {trait.tiers.map((t, i) => <div className={`detail-tier${i === tier ? ' active' : ''}`} key={t.count}><b>{t.count}명 {i === tier ? '· 현재 활성' : count >= t.count ? '· 달성' : '· 미달성'}</b><p><EffectDescription text={t.description} /></p></div>)}
    <h4>이번 시즌의 해당 기물</h4><div className="detail-trait-roster">{members.map(u => <div key={u.id}><Portrait id={u.id} name={u.nameKo} size={30} /><span>{u.nameKo}</span><b>{u.cost}G</b><button className="trait-wishlist" aria-label={u.nameKo+' 희망 기물'} aria-pressed={!!wishlist[player.seasonId ?? 's1']?.includes(u.id)} onClick={()=>toggle(player.seasonId ?? 's1',u.id)}>{wishlist[player.seasonId ?? 's1']?.includes(u.id)?'★':'☆'}</button></div>)}</div>
  </>;
}

export function DetailPanel(): JSX.Element | null {
  const inspection = useInteractionStore(s => s.inspection);
  const inspect = useInteractionStore(s => s.inspect);
  const frames = useGameStore(s => s.viewedBattleFrames());
  const time = useGameStore(s => s.battleTime);
  const running = useGameStore(s => s.battleRunning);
  const match = useGameStore(s => s.match);
  useGameStore(s => s.revision);
  if (!inspection || !match) return null;
  const frame = running && frames?.length ? frames[frameAt(frames, time)] : null;
  let body: JSX.Element;
  if (inspection.kind === 'augment') {
    const aug = getAugment(inspection.id), owner = match.players.find(p=>p.id === inspection.playerId);
    const progress = owner?.augmentProgress?.[aug.id] ?? 0;
    body = <div className="augment-detail"><h3>{aug.name}</h3><span className="pill">{{ S: '실버', G: '골드', P: '프리즘' }[aug.grade]} 증강</span><p><EffectDescription text={aug.description} /></p>{aug.grants?.unitId && <p className="muted">공유 풀에 재고가 없거나 대기석이 가득 차면 해당 기물 가격만큼 골드로 지급합니다.</p>}{(aug.growth || aug.rememberItem) && <p className="gold-text">영구 기록: {progress}{aug.growth ? ' / ' + aug.growth.maxStacks : ''}중첩 · 다음 전투 적용</p>}</div>;
  }
  else if (inspection.kind === 'item') body = <ItemDetail id={inspection.id} playerId={inspection.playerId} />;
  else if (inspection.kind === 'trait') body = <TraitDetail id={inspection.id} playerId={inspection.playerId} />;
  else if (inspection.kind === 'recap') {
    body = <BattleRecap />;
  } else {
    const owner = inspection.kind === 'unit' ? match.players.find(p => p.id === inspection.playerId) : match.players.find(p => inspection.id.startsWith(`${p.id}#`));
    const combatId = inspection.kind === 'combat' ? inspection.id : `${inspection.playerId}#${inspection.id}`;
    const snapshot = frame?.units.find(u => u.id === combatId);
    const unit = owner && [...owner.board, ...owner.bench].find(u => `${owner.id}#${u.instanceId}` === combatId);
    if (!unit && !snapshot) body = <p>판매되었거나 합성·전투 종료로 사라진 기물입니다. 다른 기물을 선택하세요.</p>;
    else {
      const def = getUnitDef(snapshot?.unitDefId ?? unit!.unitDefId), star = snapshot?.star ?? unit!.star;
      const items = snapshot?.items ?? unit?.items ?? [];
      const stats = snapshot?.stats ?? buildBaseStats(def.id, star, items);
      const hp = snapshot?.hp ?? Math.round(stats.hp), maxHp = snapshot?.maxHp ?? Math.round(stats.hp);
      const mana = snapshot?.mana ?? stats.startMana, maxMana = snapshot?.maxMana ?? stats.maxMana;
      const traits = snapshot?.traits ?? [...new Set([...getUnitTraits(def.id, owner?.seasonId ?? match.seasonId), ...items.flatMap(id => getItem(id).grantsTrait ? [getItem(id).grantsTrait!] : []), ...(owner?.bonusTraits.filter(t => t.instanceId === unit?.instanceId).map(t => t.trait) ?? [])])];
      const effective = matchSkillDescription(def, owner, { star, abilityPower: stats.abilityPower, items, traits });
      const skill = effective.skill;
      body = <>
        <div className="detail-heading"><Portrait id={def.id} name={def.nameKo} size={58} /><div><h3>{def.nameKo}</h3><b className="gold-text">{'★'.repeat(star)} · {def.cost}코스트</b></div></div>
        <RoleChip role={def.role} /><div className="detail-traits">{traits.map(id => <button key={id} className="pill" onClick={() => inspect({ kind: 'trait', id, playerId: owner?.id ?? useGameStore.getState().human()!.id })}>{getTrait(id).name}</button>)}</div>
        <div className="detail-vital health"><span style={{ width: `${Math.min(100, hp / Math.max(1, maxHp) * 100)}%` }} /><b>체력 {hp} / {maxHp}</b></div>
        <div className="detail-vital mana"><span style={{ width: `${Math.min(100, mana / Math.max(1, maxMana) * 100)}%` }} /><b>마나 {Math.round(mana)} / {Math.round(maxMana)}</b></div>
        <p className="muted">{snapshot ? '전투 중 현재 능력치' : '별 등급·장착 아이템 반영 · 특성의 전투 효과는 전투 시작 후 반영'}</p>
        <dl className="detail-stats">{([
          ['공격력', Math.round(stats.attackDamage)], ['주문력', Math.round(stats.abilityPower)],
          ['방어력', Math.round(stats.armor)], ['마법저항력', Math.round(stats.magicResist)],
          ['공격속도', stats.attackSpeed.toFixed(2)], ['사거리', `${stats.attackRange}칸`],
          ['치명타 확률', `${Math.round(stats.critChance * 100)}%`], ['치명타 피해', `${Math.round(stats.critMultiplier * 100)}%`],
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {!!snapshot?.shield && <p>보호막 {snapshot.shield}</p>}
        <h4>{skill.displayName}</h4><p className="muted">{effective.changes.length ? '전용 증강 반영 · '+star+'성 · 주문력 '+Math.round(stats.abilityPower)+' 기준' : '기본 동작 · 1성/주문력 100'}</p>
        <p className="match-skill-description"><EffectDescription text={effective.description} /></p>
        {effective.changes.length > 0 && <div className="match-augment-changes" aria-label="이 기물의 증강 효과">{effective.changes.map(line=><p key={line}><EffectDescription text={line} /></p>)}<details><summary>기본 스킬 설명</summary><p><EffectDescription text={def.skill.description} /></p></details></div>}
        <SkillValues skill={skill} cost={def.cost} star={star} abilityPower={stats.abilityPower} />
        <h4>장착 아이템 · {items.length}/3</h4>{items.length ? items.map((id, i) => <ItemLink key={`${id}-${i}`} id={id} playerId={owner?.id} />) : <p className="muted">장착한 아이템이 없습니다.</p>}
        {owner?.isHuman && unit && <button className="detail-sell" disabled={running && !!unit.position} onClick={() => useGameStore.getState().sell(unit.instanceId)}>판매 · {sellPrice(owner, unit)}G</button>}
      </>;
    }
  }
  return <section className="panel detail-panel" aria-label="상세 정보"><div className="detail-toolbar"><strong>상세 정보</strong><button className="btn-ghost" aria-label="상세 정보 닫기" onClick={() => inspect(null)}>✕</button></div>{body}</section>;
}
