import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getUnitDef } from '../../game/engine/roster';
import { getItem } from '../../game/engine/items/item-defs';
import { resultLineups } from '../../game/engine/rounds/result-lineups';
import type { UnitInstance } from '../../game/engine/state';
import { Portrait, ItemIcon, costVar } from '../common';

export function ResultScreen(): JSX.Element {
  const match = useGameStore(s => s.match);
  const setScreen = useGameStore(s => s.setScreen);
  const abandon = useGameStore(s => s.abandonMatch);
  const [selected, setSelected] = useState<UnitInstance | null>(null);
  const detail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected && window.matchMedia('(max-width: 700px)').matches) detail.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  if (!match) return <div />;
  const human = match.players.find(p => p.isHuman);
  const lineups = resultLineups(match, human);
  const finished = match.phase === 'GAME_OVER';
  const ordered = [...match.players].sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0) || b.hp - a.hp || a.id.localeCompare(b.id));
  const exit = human && lineups.get(human.id);
  const def = selected && getUnitDef(selected.unitDefId);

  return <div className="menu-screen result-screen results-layout">
    <header className="results-heading"><div className="eyebrow">RACE COMPLETE</div><h1>경기 결과</h1>
      <p>{finished ? '최종 순위' : '탈락 시점 순위 · 생존 플레이어 순위는 미확정'}
        {human?.eliminatedAtRound != null && exit ? ` · 편성은 내 탈락 시점 ${exit.stage}-${exit.round} 기준` : ' · 각 플레이어의 마지막 전장 편성'}</p>
    </header>
    <div className="results-content">
      <section className="panel result-roster" aria-label="플레이어별 결과 편성">
        {ordered.map((player, index) => {
          const lineup = lineups.get(player.id);
          return <article key={player.id} className={`result-player${player.isHuman ? ' is-human' : ''}`} aria-label={`${player.name} 결과`}>
            <strong className={`result-place${index < 3 ? ' podium' : ''}`}>{player.placement ?? index + 1}</strong>
            <div className="result-player-info"><b>{player.name}</b><span>Lv.{lineup?.level ?? player.level} · {player.placement == null ? '진행 중' : `${player.placement}위 확정`}</span>
              {lineup && <small>{lineup.stage}-{lineup.round} · 전장 {lineup.units.length}명</small>}</div>
            <div className="result-units">
              {lineup?.units.map(unit => {
                const character = getUnitDef(unit.unitDefId);
                return <button className="result-unit" key={unit.instanceId} onClick={() => setSelected(unit)}
                  style={{ borderColor: costVar(character.cost) }} aria-label={`${character.nameKo} ${unit.star}성 · 아이템 ${unit.items.length}개`}>
                  <span className="result-stars" aria-hidden="true">{'★'.repeat(unit.star)}</span>
                  <Portrait id={character.id} name={character.nameKo} size={44} />
                  <span className="result-unit-items">{unit.items.map((id, i) => <ItemIcon key={`${id}-${i}`} itemId={id} size={17} />)}</span>
                </button>;
              })}
              {(!lineup || !lineup.units.length) && <span className="muted">{lineup ? '배치된 기물 없음' : '이전 저장 파일에 편성 기록 없음'}</span>}
            </div>
          </article>;
        })}
      </section>
      <aside className="panel result-summary">
        <span className="eyebrow">{human?.placement === 1 ? 'CHAMPION' : 'YOUR RESULT'}</span>
        <strong className="result-your-place">{human?.placement ?? '—'}<small>위</small></strong>
        <p>{human?.placement === 1 ? '트윙클 아레나의 우승자!' : '다음 레이스에서 다시 도전하세요.'}</p>
        <div className="result-actions">
          <button className="btn-primary" onClick={() => { abandon(); setScreen('MATCH_SETUP'); }}>새 게임</button>
          <button className="btn-ghost" onClick={() => { abandon(); setScreen('MAIN_MENU'); }}>메인 메뉴</button>
        </div>
        <small className="muted">시드 {match.seed} · {match.history.length} 라운드</small>
        {selected && def ? <div ref={detail} className="result-unit-detail" role="status"><Portrait id={def.id} name={def.nameKo} size={72} /><h3>{def.nameKo}</h3>
          <p>{selected.star}성 · {def.cost}코스트</p>
          {selected.items.length ? selected.items.map((id, i) => <div className="result-item-detail" key={`${id}-${i}`}><ItemIcon itemId={id} size={25} /><span>{getItem(id).name}</span></div>) : <p className="muted">장착 아이템 없음</p>}
        </div> : <p className="muted result-inspect-hint">기물을 누르면 별 등급과 장착 아이템을 확인할 수 있습니다.</p>}
      </aside>
    </div>
  </div>;
}
