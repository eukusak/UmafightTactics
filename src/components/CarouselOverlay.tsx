import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { CAROUSEL, carouselPosition } from '../game/engine/rounds/carousel';
import { getUnitDef } from '../game/engine/roster';
import { getItem } from '../game/engine/items/item-defs';
import { AnimatedUnit } from './AnimatedUnit';
import { ItemIcon, costVar } from './common';
import '../styles/carousel.css';

const TRAINERS = ['special_week', 'silence_suzuka', 'tokai_teio', 'mejiro_mcqueen', 'gold_ship', 'vodka', 'daiwa_scarlet', 'rice_shower'];
const COLORS = ['#73ffe1', '#ffbd71', '#aeb5ff', '#ff93d0', '#d2ed81', '#8cceff', '#f6dd81', '#e7adff'];
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function DraftOverlay(): JSX.Element | null {
  const match = useGameStore(s => s.match);
  const human = useGameStore(s => s.human());
  const move = useGameStore(s => s.moveCarousel);
  useGameStore(s => s.revision);
  const arena = useRef<HTMLDivElement>(null);
  const active = !!match?.draft?.carousel;

  useEffect(() => {
    if (!active) return;
    arena.current?.focus();
    const held = new Set<string>();
    const stop = () => {
      if (!held.size) return;
      held.clear();
      const s = useGameStore.getState(), me = s.match?.draft?.carousel?.avatars.find(a => a.playerId === s.human()?.id);
      if (me) s.moveCarousel({ x: me.x, y: me.y });
    };
    const down = (e: KeyboardEvent) => {
      if (!ARROWS.has(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); held.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      if (!ARROWS.has(e.code)) return;
      e.preventDefault();
      if (held.size === 1 && held.has(e.code)) stop(); else held.delete(e.code);
    };
    let previous = performance.now(), commandAt = 0;
    const timer = window.setInterval(() => {
      const now = performance.now(), s = useGameStore.getState();
      if (held.size && now - commandAt >= 100) {
        const me = s.match?.draft?.carousel?.avatars.find(a => a.playerId === s.human()?.id);
        if (me && me.picked === null) s.moveCarousel({
          x: me.x + (Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'))) * 100,
          y: me.y + (Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'))) * 100,
        });
        commandAt = now;
      }
      s.tickCarousel(Math.min(250, now - previous)); previous = now;
    }, 50);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', stop);
    return () => {
      clearInterval(timer); window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up); window.removeEventListener('blur', stop);
    };
  }, [active]);

  const draft = match?.draft, c = draft?.carousel;
  if (!draft || !c || !human) return null;
  const me = c.avatars.find(a => a.playerId === human.id);
  const locked = !!me && c.elapsed < me.releaseAt;
  const picked = me?.picked !== null && me?.picked !== undefined;
  const remaining = Math.max(0, Math.ceil(((me?.releaseAt ?? 0) - c.elapsed) / 1000));
  const award = picked ? draft.options.find(o => o.index === me?.picked) : null;
  const moveOnFloor = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button') || !arena.current || picked) return;
    const rect = arena.current.getBoundingClientRect();
    move({ x: (e.clientX - rect.left) / rect.width * CAROUSEL.width, y: (e.clientY - rect.top) / rect.height * CAROUSEL.height });
    arena.current.focus();
  };

  return <div className="overlay draft-overlay">
    <section className="carousel-panel" aria-label="트윙클 공동 선택">
      <header className="carousel-header">
        <div><span className="carousel-eyebrow">TWINKLE CAROUSEL</span><h2>먼저 도착한 트레이너의 기물!</h2></div>
        <div className={`carousel-status ${picked ? 'complete' : ''}`} role="status">
          {picked ? `${award ? getUnitDef(award.unitDefId).nameKo : '기물'} 획득!` : locked ? `${remaining}초 후 출발` : '내 캐릭터를 움직이세요'}
          <small>{picked ? '다른 트레이너의 선택을 기다립니다' : match.stage === 1 && match.round === 1 ? '첫 선택은 모두 함께 출발합니다' : '체력이 낮은 트레이너부터 2명씩 출발합니다'}</small>
        </div>
      </header>
      <div ref={arena} className="carousel-arena" tabIndex={0} aria-label="공동 선택 경기장: 클릭 또는 방향키로 이동"
        onClick={moveOnFloor} onContextMenu={e => { e.preventDefault(); moveOnFloor(e); }}>
        <div className="carousel-track" /><div className="carousel-center"><span>TWINKLE</span><b>공동 선택</b><small>{draft.options.filter(o => o.takenBy).length} / {draft.order.length} 획득</small></div>
        {me && !picked && !locked && <div className="carousel-destination" style={{ left: me.target.x, top: me.target.y }} />}
        {draft.options.map(o => {
          if (o.takenBy) return null;
          const pos = carouselPosition(o.index, draft.options.length, c.angle), def = getUnitDef(o.unitDefId);
          return <button key={o.index} className={`carousel-option ${me?.targetOption === o.index ? 'targeted' : ''}`}
            data-option-index={o.index} aria-label={`${def.nameKo} · ${getItem(o.itemId).name} 향해 이동`}
            disabled={picked || !me} style={{ left: pos.x, top: pos.y, borderColor: costVar(def.cost), zIndex: Math.round(pos.y) }}
            onClick={() => { move(pos, o.index); arena.current?.focus(); }}>
            <AnimatedUnit id={def.id} size={110} action="run" />
            <span className="carousel-item"><ItemIcon itemId={o.itemId} size={26} /></span>
            <span className="carousel-unit-name">{def.nameKo}<small>{def.cost}G · {getItem(o.itemId).name}</small></span>
          </button>;
        })}
        {c.avatars.map(a => {
          const index = match.players.findIndex(p => p.id === a.playerId), mine = a.playerId === human.id;
          const waiting = c.elapsed < a.releaseAt;
          const moving = !waiting && Math.hypot(a.x - (a.picked !== null ? a.home.x : a.target.x), a.y - (a.picked !== null ? a.home.y : a.target.y)) > 4;
          const loot = draft.options.find(o => o.index === a.picked);
          return <div key={a.playerId} className={`carousel-trainer ${mine ? 'mine' : ''} ${waiting ? 'waiting' : ''}`}
            data-player-id={a.playerId} data-picked={a.picked ?? ''} data-x={a.x.toFixed(2)} data-y={a.y.toFixed(2)}
            style={{ left: a.x, top: a.y, color: COLORS[index], zIndex: Math.round(a.y) + 1 }}>
            <span className="trainer-ring" /><AnimatedUnit id={TRAINERS[index % TRAINERS.length]} size={100} action={moving ? 'run' : 'idle'} />
            <span className="trainer-label">{mine ? '▼ 나' : match.players[index].name}{waiting ? ' 🔒' : ''}</span>
            {loot && <span className="trainer-loot">✓ {getUnitDef(loot.unitDefId).nameKo}<ItemIcon itemId={loot.itemId} size={22} /></span>}
          </div>;
        })}
      </div>
      <footer className="carousel-footer"><span><kbd>좌클릭 / 우클릭</kbd> 바닥으로 이동 · 기물을 누르면 따라가기</span><span><kbd>↑ ↓ ← →</kbd> 직접 이동</span><span>접촉 시 기물 + 재료 획득 · 12초간 선택하지 않으면 자동 이동</span></footer>
    </section>
  </div>;
}
