/** One background and projection across preparation and recorded combat. */
import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useGameStore } from '../store/gameStore';
import { BattleScene } from '../game/phaser/BattleScene';
import { Portrait } from './common';
import { getUnitDef } from '../game/engine/roster';
import { prepPoint, boardHexPoints } from '../game/ui/board-projection';
import { arenaUrl, standeeUrl } from '../game/ui/art';
import { roundInfo } from '../game/engine/rounds/schedule';
import type { UnitInstance } from '../game/engine/state';

const FIELD_W = 1320;
const FIELD_H = 658;

export function ArenaBackdrop(): JSX.Element {
  const match = useGameStore((s) => s.match);
  const running = useGameStore((s) => s.battleRunning);
  useGameStore((s) => s.revision);
  const background = arenaUrl(match?.stage, !!match && roundInfo(match.stage, match.round).kind === 'PVE');
  return <div className="arena-backdrop" style={{ backgroundImage: `url(${background})` }}>
    <svg className="arena-grid" width={FIELD_W} height={FIELD_H} aria-hidden="true">
      {Array.from({ length: 56 }, (_, i) => {
        const cell = { q: i % 7, r: Math.floor(i / 7) };
        return <polygon key={i} points={boardHexPoints(cell).map((p) => `${p.x},${p.y}`).join(' ')} className={cell.r < 4 ? 'enemy' : 'friendly'} />;
      })}
    </svg>
    <div className="arena-phase-label">TWINKLE ARENA <span>{running ? '전투' : '준비 · 클릭 또는 드래그로 배치'}</span></div>
  </div>;
}

export function PrepBoard({ onUnitContext }: { onUnitContext: (e: React.MouseEvent, unit: UnitInstance) => void }): JSX.Element | null {
  const player = useGameStore((s) => s.human());
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const running = useGameStore((s) => s.battleRunning);
  const [dragOver, setDragOver] = useState<string | null>(null);
  useGameStore((s) => s.revision);
  if (!player) return null;
  const drop = (e: React.DragEvent, q: number, r: number, unit?: UnitInstance): void => {
    e.preventDefault(); setDragOver(null);
    const store = useGameStore.getState();
    const item = e.dataTransfer.getData('application/x-item');
    const id = e.dataTransfer.getData('application/x-unit');
    if (item && unit) store.equip(unit.instanceId, item);
    else if (id) store.moveUnit(id, { q, r });
  };
  const click = (q: number, r: number, unit?: UnitInstance): void => {
    const store = useGameStore.getState();
    if (selectedUnitId) store.placeSelected({ q, r });
    else if (unit) store.selectUnit(unit.instanceId);
  };
  return <div className="prep-layer" style={{ pointerEvents: running ? 'none' : undefined }}>
    {Array.from({ length: 28 }, (_, i) => {
      const q = i % 7, r = Math.floor(i / 7), key = `${q},${r}`;
      const p = prepPoint({ q, r });
      const unit = player.board.find((u) => u.position?.q === q && u.position.r === r);
      return <div key={key} className={`arena-cell${dragOver === key ? ' hovered' : ''}`}
        style={{ position: 'absolute', left: p.x - 50 * p.scale, top: p.y - 30, width: 100 * p.scale, height: 60 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(key); }} onDragLeave={() => setDragOver(null)}
        onDrop={(e) => drop(e, q, r, unit)} onClick={() => click(q, r, unit)} />;
    })}
    {player.board.filter((u) => u.position).map((unit) => {
      const p = prepPoint(unit.position!); const def = getUnitDef(unit.unitDefId); const sprite = standeeUrl(def.id);
      return <div key={unit.instanceId} className={`arena-unit${selectedUnitId === unit.instanceId ? ' selected' : ''}`}
        data-unit-id={unit.instanceId} data-unit-def={unit.unitDefId}
        style={{ transform: `translate3d(${p.x}px,${p.y}px,0) scale(${p.scale})`, zIndex: Math.round(p.y) }}>
        <div className="arena-unit-touch" draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-unit', unit.instanceId); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, unit.position!.q, unit.position!.r, unit)}
          onClick={() => click(unit.position!.q, unit.position!.r, unit)}
          onContextMenu={(e) => { e.preventDefault(); onUnitContext(e, unit); }}>
          <span className="arena-unit-base" style={{ borderColor: `var(--cost-${def.cost})` }} />
          {sprite ? <img className="arena-standee" src={sprite} alt={def.nameKo} draggable={false} /> : <div className="arena-unit-portrait"><Portrait id={def.id} name={def.nameKo} /></div>}
          <span className="arena-unit-stars" style={{ top: sprite ? 14 : 61 }}>{'★'.repeat(unit.star)}</span>
          <span className="arena-unit-health" />
          <span className="arena-unit-name">{def.nameKo}</span>
        </div>
      </div>;
    })}
  </div>;
}

/** Phaser-hosted playback of the recorded battle frames. */
export function BattleBoard({ onFinished, onReady }: { onFinished: () => void; onReady: () => void }): JSX.Element {
  const frames = useGameStore((s) => s.battleFrames);
  const speed = useGameStore((s) => s.settings.battleSpeed);
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const state = useGameStore.getState();
    const scene = new BattleScene(frames ?? [], state.settings.showDamageNumbers, onReady);
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: FIELD_W,
      height: FIELD_H,
      transparent: true,
      antialias: true,
      scene: [scene],
      audio: { noAudio: true },
      banner: false,
    });
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // This host is mounted once per battle recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !frames) return;
    doneRef.current = false;
    // The scene queues this itself when Phaser has not finished booting.
    scene.playBattle(frames, useGameStore.getState().settings.battleSpeed);
  }, [frames]);

  useEffect(() => {
    sceneRef.current?.setSpeed(speed);
  }, [speed]);

  // Poll for playback completion; the scene owns the clock.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const scene = sceneRef.current;
      if (!scene || doneRef.current) return;
      if (scene.finished) {
        doneRef.current = true;
        onFinished();
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [onFinished]);

  return <div ref={hostRef} className="battle-layer" style={{ width: FIELD_W, height: FIELD_H }} />;
}
