/** Augment select, twinkle draft, battle result banner and the dev panel. */
import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AUGMENT_BY_ID, ACTIVE_UNITS, getUnitDef } from '../game/engine/roster';
import { getItem } from '../game/engine/items/item-defs';
import { currentPickers } from '../game/engine/rounds/draft';
import { Portrait, ItemIcon, costVar } from './common';

const GRADE_LABEL: Record<string, string> = { S: 'Silver', G: 'Gold', P: 'Prism' };
const GRADE_COLOR: Record<string, string> = { S: '#c9d6e0', G: '#ffcc33', P: '#b98ae0' };

export function AugmentOverlay(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  const choose = useGameStore((s) => s.chooseAugment);
  useGameStore((s) => s.revision);
  if (!match || !human) return null;

  const offer = match.augmentOffers.find((o) => o.playerId === human.id && o.chosen === null);
  if (!offer) return null;

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2 style={{ margin: 0, color: GRADE_COLOR[offer.grade] }}>
          증강체 선택 — {GRADE_LABEL[offer.grade]}
        </h2>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          하나를 선택하면 남은 준비 단계가 이어집니다.
        </p>
        <div className="choice-grid">
          {offer.options.map((id) => {
            const aug = AUGMENT_BY_ID.get(id);
            return (
              <button key={id} className="choice-card" onClick={() => choose(id)}
                style={{ borderColor: GRADE_COLOR[offer.grade] }}>
                <img src={`/assets/augments/${id}.png`} alt="" width={82} height={82} /><h4>{aug?.name ?? id}</h4>
                <p>{aug?.description ?? ''}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DraftOverlay(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  const pick = useGameStore((s) => s.pickDraft);
  useGameStore((s) => s.revision);
  if (!match?.draft || !human) return null;

  const pickers = currentPickers(match.draft);
  const myTurn = pickers.includes(human.id);

  return (
    <div className="overlay draft-overlay">
      <div className="overlay-card" style={{ maxWidth: 1180 }}>
        <h2 style={{ margin: 0 }}>트윙클 드래프트</h2>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {myTurn
            ? '페데스털을 클릭해 유닛과 재료 아이템을 가져가세요.'
            : '다른 트레이너가 선택하는 중입니다…'}
        </p>
        <div className="draft-grid">
          {match.draft.options.map((o) => {
            const def = getUnitDef(o.unitDefId);
            const item = getItem(o.itemId);
            return (
              <button
                key={o.index}
                className={`draft-card${o.takenBy ? ' taken' : ''}`}
                disabled={!!o.takenBy || !myTurn}
                onClick={() => pick(o.index)}
                style={{ borderColor: o.takenBy ? '#2b3d4f' : costVar(def.cost) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                  <div className="token" style={{ width: 46, height: 46, fontSize: 18, border: `3px solid ${costVar(def.cost)}` }}>
                    <Portrait id={def.id} name={def.nameKo} size={74} />
                  </div>
                  <ItemIcon itemId={o.itemId} size={30} />
                </div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>{def.nameKo}</div>
                <div className="muted" style={{ fontSize: 12 }}>{def.cost}코 · {item.name}</div>
                {o.takenBy && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {match.players.find((p) => p.id === o.takenBy)?.name} 선택
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function BattleResultOverlay({ onContinue }: { onContinue: () => void }): JSX.Element | null {
  const autoContinue = useGameStore((s) => s.settings.autoContinue);
  const [held, setHeld] = useState(false);
  const [remaining, setRemaining] = useState(5);
  useEffect(() => {
    if (!autoContinue || held) return;
    const timer = window.setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [autoContinue, held]);
  useEffect(() => { if (autoContinue && !held && remaining === 0) onContinue(); }, [autoContinue, held, remaining, onContinue]);
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  useGameStore((s) => s.revision);
  const res = match?.lastResolution;
  if (!res || !human) return null;

  const mine = res.outcomes.find((o) => o.attackerId === human.id || (!o.isGhost && o.defenderId === human.id));
  const damage = res.damage[human.id] ?? 0;
  const won = mine ? mine.winnerId === human.id : false;
  const draw = mine ? mine.winnerId === null : false;

  const label = res.kind === 'PVE' ? (won ? 'PvE 클리어' : 'PvE 실패') : draw ? '무승부' : won ? '승리' : '패배';
  const color = draw ? 'var(--muted)' : won ? 'var(--success)' : 'var(--danger)';

  return (
    <div className="overlay">
      <div className="overlay-card" style={{ textAlign: 'center', borderColor: color }}>
        <h2 style={{ margin: 0, fontSize: 42, color, width: 600, padding: '28px 80px', background: `url(/assets/ui/banner_${draw ? 'draw' : won ? 'victory' : 'defeat'}.png) center / 100% 100%` }}>{label}</h2>
        {damage > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 18 }} className="danger-text">
            체력 -{damage}
          </p>
        )}
        {mine && (
          <p className="muted" style={{ margin: '8px 0 0' }}>
            {mine.isGhost && '고스트 보드 · '}
            생존 {mine.winnerId === human.id ? mine.survivorsWinner : mine.survivorsLoser}기
            {mine.wentToOvertime && ' · 오버타임'}
            {' · '}{mine.durationSeconds.toFixed(1)}초
          </p>
        )}
        {res.eliminated.length > 0 && (
          <p className="muted" style={{ marginTop: 10 }}>
            탈락: {res.eliminated.map((id) => match?.players.find((p) => p.id === id)?.name).join(', ')}
          </p>
        )}
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onContinue}>
          다음 라운드로{autoContinue && !held ? ` · ${remaining}초` : ''}
        </button>
        {autoContinue && <button className="btn-ghost" style={{ marginLeft: 10 }} onClick={() => setHeld((value) => !value)}>{held ? '자동 진행 재개' : '결과 계속 보기'}</button>}
      </div>
    </div>
  );
}

export function DevPanel(): JSX.Element | null {
  const devMode = useGameStore((s) => s.devMode);
  const grant = useGameStore((s) => s.devGrant);
  const match = useGameStore((s) => s.match);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const [unitQuery, setUnitQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  useGameStore((s) => s.revision);
  if (!devMode || !match) return null;

  const matches = ACTIVE_UNITS.filter((u) => u.nameKo.includes(unitQuery)).slice(0, 5);

  return (
    <div className={`panel dev-panel scroll${collapsed ? ' collapsed' : ''}`}>
      <div className="dev-head">
        <h4 style={{ margin: 0 }}>개발자 패널 <span className="muted">?dev=1</span></h4>
        <button className="btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
      <div className="row">
        <button onClick={() => grant('gold10')}>+10G</button>
        <button onClick={() => grant('gold50')}>+50G</button>
        <button onClick={() => grant('xp20')}>+XP</button>
      </div>
      <div className="row">
        <button onClick={() => grant('hp1')}>HP 1</button>
        <button onClick={() => grant('hp50')}>HP 50</button>
        <button onClick={() => grant('hp100')}>HP 100</button>
      </div>
      <div className="row">
        <button onClick={() => grant('components')}>재료 10종</button>
        <button onClick={() => grant('nextRound')}>다음 라운드</button>
      </div>
      <div className="row">
        {[1, 2, 4, 10].map((s) => (
          <button
            key={s}
            className={settings.battleSpeed === s ? 'btn-primary' : ''}
            onClick={() => setSettings({ battleSpeed: s as 1 | 2 | 4 | 10 })}
          >
            {s}×
          </button>
        ))}
      </div>
      <input
        placeholder="유닛 검색"
        value={unitQuery}
        onChange={(e) => setUnitQuery(e.target.value)}
        style={{ width: '100%', marginBottom: 6, background: 'var(--panel-bright)', color: 'var(--text)',
          border: '2px solid var(--edge-light)', borderRadius: 6, padding: '5px 8px' }}
      />
      <div className="row">
        {matches.map((u) => (
          <button key={u.id} onClick={() => grant('unit', u.id)}>{u.nameKo}</button>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        시드 <code>{match.seed}</code> · 로스터 <code>{match.activeRosterHash}</code>
      </div>
      <div className="muted" style={{ fontSize: 11 }}>
        풀 잔량 {Object.values(match.pool.remaining).reduce((a, b) => a + b, 0)}
      </div>
      <button
        className="btn-ghost"
        style={{ width: '100%', marginTop: 8 }}
        onClick={() => {
          const blob = new Blob([JSON.stringify(match, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `uft-save-${match.seed}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        세이브 JSON 다운로드
      </button>
    </div>
  );
}
