/** Augment select, twinkle draft, battle result banner and the dev panel. */
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AUGMENT_BY_ID } from '../game/engine/roster';

const GRADE_LABEL: Record<string, string> = { S: 'Silver', G: 'Gold', P: 'Prism' };
const GRADE_COLOR: Record<string, string> = { S: '#c9d6e0', G: '#ffcc33', P: '#b98ae0' };

export function AugmentOverlay(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  const choose = useGameStore((s) => s.chooseAugment);
  useGameStore((s) => s.revision);
  const [selected, setSelected] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const select = (id: string) => {
    if (timer.current) return;
    setSelected(id);
    timer.current = setTimeout(() => { choose(id); timer.current = undefined; setSelected(null); }, 550);
  };
  if (!match || !human) return null;

  const offer = match.augmentOffers.find((o) => o.playerId === human.id && o.chosen === null);
  if (!offer) return null;

  return (
    <div className={`overlay augment-overlay${selected ? ' choosing' : ''}`}>
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
              <button key={id} className={`choice-card${selected === id ? ' chosen' : ''}`} disabled={selected !== null} onClick={() => select(id)}
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

export { DraftOverlay } from './CarouselOverlay';

export function BattleResultOverlay({ onContinue }: { onContinue: () => void }): JSX.Element | null {
  const online = useGameStore((s) => s.onlinePlayerId !== null);
  const autoContinue = useGameStore((s) => !s.onlinePlayerId && s.settings.autoContinue);
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
        <button className="btn-primary" style={{ marginTop: 20 }} disabled={online} onClick={onContinue}>
          {online ? '다음 라운드 대기 중' : '다음 라운드로'}{autoContinue && !held ? ` · ${remaining}초` : ''}
        </button>
        {autoContinue && <button className="btn-ghost" style={{ marginLeft: 10 }} onClick={() => setHeld((value) => !value)}>{held ? '자동 진행 재개' : '결과 계속 보기'}</button>}
      </div>
    </div>
  );
}
