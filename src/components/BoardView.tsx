/**
 * The battlefield. In prep it is a DOM hex grid for drag/drop; during a fight it
 * hands playback to the Phaser scene.
 */
import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useGameStore } from '../store/gameStore';
import { BOARD_COLS, BOARD_ROWS_PER_SIDE } from '../game/engine/constants';
import { BattleScene } from '../game/phaser/BattleScene';
import { UnitToken } from './common';
import { prepPoint } from '../game/ui/board-projection';
import { arenaUrl } from '../game/ui/art';
import { roundInfo } from '../game/engine/rounds/schedule';
import type { UnitInstance } from '../game/engine/state';

const FIELD_W = 1320;
const FIELD_H = 658;

export function PrepBoard({
  onUnitContext,
}: {
  onUnitContext: (e: React.MouseEvent, unit: UnitInstance) => void;
}): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const player = useGameStore((s) => s.human());
  const moveUnit = useGameStore((s) => s.moveUnit);
  const equip = useGameStore((s) => s.equip);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const placeSelected = useGameStore((s) => s.placeSelected);
  const [dragOver, setDragOver] = useState<string | null>(null);
  useGameStore((s) => s.revision);
  if (!player) return null;

  const byCell = new Map<string, UnitInstance>();
  for (const u of player.board) if (u.position) byCell.set(`${u.position.q},${u.position.r}`, u);

  const cells: JSX.Element[] = [];
  for (let r = 0; r < BOARD_ROWS_PER_SIDE; r += 1) {
    for (let q = 0; q < BOARD_COLS; q += 1) {
      const key = `${q},${r}`;
      const unit = byCell.get(key);
      const { x, y, scale } = prepPoint({ q, r });

      cells.push(
        <div
          key={key}
          className={`arena-cell${unit ? ' occupied' : ''}${dragOver === key ? ' hovered' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
          onDragLeave={() => setDragOver((d) => (d === key ? null : d))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(null);
            const unitId = e.dataTransfer.getData('application/x-unit');
            const itemId = e.dataTransfer.getData('application/x-item');
            if (itemId && unit) equip(unit.instanceId, itemId);
            else if (unitId) moveUnit(unitId, { q, r });
          }}
          onClick={() => {
            // Click-to-place: pick a unit up with one click, drop it with another.
            if (selectedUnitId) placeSelected({ q, r });
            else if (unit) selectUnit(unit.instanceId);
          }}
          style={{
            position: 'absolute', left: x - 50 * scale, top: y - 30,
            width: 100 * scale, height: 60,
            display: 'grid', placeItems: 'center',
            background: dragOver === key ? 'rgba(79,227,255,0.3)' : selectedUnitId ? 'rgba(79,227,255,0.14)' : undefined,
            cursor: selectedUnitId || unit ? 'pointer' : 'default',
            transition: 'background 0.1s ease',
          }}
        >
          {unit && (
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-unit', unit.instanceId);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onContextMenu={(e) => { e.preventDefault(); onUnitContext(e, unit); }}
              style={{
                cursor: 'grab', position: 'relative', top: -25,
                filter: selectedUnitId === unit.instanceId ? 'drop-shadow(0 0 8px var(--gold))' : undefined,
              }}
            >
              <UnitToken unit={unit} size={62} />
            </div>
          )}
        </div>,
      );
    }
  }

  return (
    <div style={{ position: 'relative', width: FIELD_W, height: FIELD_H }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `url(${arenaUrl(match?.stage, !!match && roundInfo(match.stage, match.round).kind === 'PVE')}) center / 100% 100%`,
        borderRadius: 10, border: '2px solid #24384a',
      }} />
      <div style={{ position: 'absolute', top: 14, left: 20, color: '#fff5da', fontSize: 14, background: '#122a3b', padding: '8px 14px', borderRadius: 6 }}>
        TWINKLE ARENA  /  준비 단계 · 클릭 또는 드래그로 배치
      </div>
      {cells}
    </div>
  );
}

/** Phaser-hosted playback of the recorded battle frames. */
export function BattleBoard({ onFinished }: { onFinished: () => void }): JSX.Element {
  const frames = useGameStore((s) => s.battleFrames);
  const speed = useGameStore((s) => s.settings.battleSpeed);
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const state = useGameStore.getState();
    const match = state.match;
    const scene = new BattleScene(frames ?? [], state.settings.showDamageNumbers, arenaUrl(match?.stage, !!match && roundInfo(match.stage, match.round).kind === 'PVE'));
    sceneRef.current = scene;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: FIELD_W,
      height: FIELD_H,
      backgroundColor: '#101823',
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

  return <div ref={hostRef} style={{ width: FIELD_W, height: FIELD_H, borderRadius: 10, overflow: 'hidden' }} />;
}
