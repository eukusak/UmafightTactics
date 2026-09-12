/** One background and projection across preparation and recorded combat. */
import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useGameStore } from '../store/gameStore';
import { BattleScene } from '../game/phaser/BattleScene';
import { AnimatedUnit } from './AnimatedUnit';
import { getUnitDef } from '../game/engine/roster';
import { prepPoint, boardHexPoints } from '../game/ui/board-projection';
import { arenaUrl } from '../game/ui/art';
import { roundInfo } from '../game/engine/rounds/schedule';
import { useInteractionStore } from '../store/interactionStore';
import { frameAt, orientSnapshot, samplePosition } from '../game/ui/battle-playback';
import type { UnitInstance } from '../game/engine/state';
import { ItemIcon } from './common';

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
  const player = useGameStore((s) => s.viewedPlayer());
  const spectating = useGameStore(s => s.spectating);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const running = useGameStore((s) => s.battleRunning);
  const [dragOver, setDragOver] = useState<string | null>(null);
  useGameStore((s) => s.revision);
  if (!player) return null;
  const drop = (e: React.DragEvent, q: number, r: number, unit?: UnitInstance): void => {
    e.preventDefault(); setDragOver(null);
    if (spectating || running) return;
    const store = useGameStore.getState();
    const item = e.dataTransfer.getData('application/x-item');
    const id = e.dataTransfer.getData('application/x-unit');
    if (item && unit) store.equip(unit.instanceId, item);
    else if (id) store.moveUnit(id, { q, r });
  };
  const click = (q: number, r: number, unit?: UnitInstance): void => {
    const store = useGameStore.getState();
    if (unit) {
      store.selectUnit(unit.instanceId);
      useInteractionStore.getState().inspect({ kind: 'unit', id: unit.instanceId, playerId: player.id });
    } else if (!spectating && selectedUnitId) store.placeSelected({ q, r });
  };
  return <div className="prep-layer" data-prep-board={spectating ? "readonly" : "editable"} data-viewed-player={player.id} style={{ pointerEvents: running ? 'none' : undefined }}>
    {Array.from({ length: 28 }, (_, i) => {
      const q = i % 7, r = Math.floor(i / 7), key = `${q},${r}`;
      const p = prepPoint({ q, r });
      const unit = player.board.find((u) => u.position?.q === q && u.position.r === r);
      return <div key={key} className={`arena-cell${dragOver === key ? ' hovered' : ''}`}
        style={{ position: 'absolute', left: p.x - 50 * p.scale, top: p.y - 30, width: 100 * p.scale, height: 60 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(key); }} onDragLeave={() => setDragOver(null)}
        data-drop={spectating ? undefined : "board"} data-q={q} data-r={r} data-drop-unit={unit?.instanceId}
        onDrop={(e) => drop(e, q, r, unit)} onClick={() => click(q, r, unit)} />;
    })}
    {player.board.filter((u) => u.position).map((unit) => {
      const p = prepPoint(unit.position!); const def = getUnitDef(unit.unitDefId);
      return <div key={unit.instanceId} className={`arena-unit${selectedUnitId === unit.instanceId ? ' selected' : ''}`}
        data-unit-id={unit.instanceId} data-unit-def={unit.unitDefId}
        style={{ transform: `translate3d(${p.x}px,${p.y}px,0) scale(${p.scale})`, zIndex: Math.round(p.y) }}>
        <div data-touch-unit={spectating ? undefined : unit.instanceId} data-drop={spectating ? undefined : "board"} data-q={unit.position!.q} data-r={unit.position!.r} data-drop-unit={unit.instanceId} className="arena-unit-touch" role="button" tabIndex={0} aria-label={`${def.nameKo} 정보`}
          onMouseEnter={() => useInteractionStore.getState().hover(unit.instanceId)}
          onMouseLeave={() => useInteractionStore.getState().hover(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(unit.position!.q, unit.position!.r, unit); } }} draggable={!spectating && !running} onDragStart={(e) => { useInteractionStore.getState().drag(unit.instanceId); e.dataTransfer.setData('application/x-unit', unit.instanceId); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, unit.position!.q, unit.position!.r, unit)}
          onClick={() => click(unit.position!.q, unit.position!.r, unit)}
          onContextMenu={(e) => { e.preventDefault(); if (spectating) useInteractionStore.getState().inspect({ kind: 'unit', id: unit.instanceId, playerId: player.id }); else onUnitContext(e, unit); }}>
          <span className="arena-unit-base" style={{ borderColor: `var(--cost-${def.cost})` }} />
          <AnimatedUnit id={def.id} name={def.nameKo} className="arena-idle" />
          <span className="arena-unit-stars" >{'★'.repeat(unit.star)}</span>
          <span className="arena-unit-health" />
          <span className="arena-unit-name">{def.nameKo}</span>
          <span className="arena-unit-items">{unit.items.map((id, i) => <ItemIcon key={`${id}-${i}`} itemId={id} size={20} />)}</span>
        </div>
      </div>;
    })}
  </div>;
}

/** Phaser-hosted playback of the recorded battle frames. */
export function BattleBoard({ onReady }: { onReady: () => void }): JSX.Element {
  const frames = useGameStore((s) => s.viewedBattleFrames());
  const complete = useGameStore((s) => s.battleComplete);
  const speed = useGameStore((s) => s.settings.battleSpeed);
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const state = useGameStore.getState();
    const scene = new BattleScene(frames ?? [], state.settings.showDamageNumbers, onReady, () => {}, state.viewedPlayer()?.id ?? 'p1', state.onlinePlayerId ? undefined : () => useGameStore.getState().battleTime);
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
    // The scene queues this itself when Phaser has not finished booting.
    const state = useGameStore.getState();
    if (state.onlinePlayerId) scene.streamFrames(frames, state.battleTime);
    else scene.playBattle(frames, state.settings.battleSpeed, state.battleTime);
  }, [frames]);

  useEffect(() => {
    sceneRef.current?.setSpeed(useGameStore.getState().battleComplete ? 0 : useGameStore.getState().onlinePlayerId ? 1 : speed);
  }, [speed, complete]);

  return <div ref={hostRef} className="battle-layer" style={{ width: FIELD_W, height: FIELD_H }} />;
}

/** Hit areas follow the same recorded positions and orientation as Phaser. */
export function BattleInspectTargets(): JSX.Element | null {
  const frames = useGameStore(s => s.viewedBattleFrames());
  const time = useGameStore(s => s.battleTime);
  const humanId = useGameStore(s => s.viewedPlayer()?.id);
  if (!frames?.length) return null;
  const index = frameAt(frames, time), frame = frames[index], next = frames[index + 1];
  const mirrored = frames[0].units.find(u => u.id.startsWith(`${humanId}#`))?.team === 'B';
  const mix = next ? (time - frame.t) / Math.max(.001, next.t - frame.t) : 0;
  return <div className="battle-inspect-layer">{frame.units.filter(u => u.alive).map(u => {
    const following = next?.units.find(n => n.id === u.id);
    const p = samplePosition(orientSnapshot(u, mirrored), following ? orientSnapshot(following, mirrored) : undefined, mix);
    const inspect = () => useInteractionStore.getState().inspect({ kind: 'combat', id: u.id });
    return <button key={u.id} className="battle-inspect-target" data-combat-id={u.id} aria-label={`${getUnitDef(u.unitDefId).nameKo} 전투 정보`}
      style={{ left: p.x - 35 * p.scale, top: p.y - 110 * p.scale, width: 70 * p.scale, height: 110 * p.scale, zIndex: Math.round(p.y) }}
      onClick={inspect} onContextMenu={e => { e.preventDefault(); inspect(); }} />;
  })}</div>;
}
