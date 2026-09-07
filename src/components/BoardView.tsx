/**
 * The battlefield. In prep it is a DOM hex grid for drag/drop; during a fight it
 * hands playback to the Phaser scene.
 */
import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useGameStore } from '../store/gameStore';
import { BOARD_COLS, BOARD_ROWS_PER_SIDE, HEX_ODD_ROW_OFFSET_X, HEX_STEP_X, HEX_STEP_Y } from '../game/engine/constants';
import { BattleScene } from '../game/phaser/BattleScene';
import { UnitToken } from './common';
import type { UnitInstance } from '../game/engine/state';

const FIELD_W = 1320;
const FIELD_H = 658;

export function PrepBoard({
  onUnitContext,
}: {
  onUnitContext: (e: React.MouseEvent, unit: UnitInstance) => void;
}): JSX.Element | null {
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
      // Row 0 is the front line, so draw the rows bottom-up for a facing board.
      const x = q * HEX_STEP_X + ((r & 1) === 1 ? HEX_ODD_ROW_OFFSET_X : 0) + 244;
      const y = (BOARD_ROWS_PER_SIDE - 1 - r) * HEX_STEP_Y + 210;

      cells.push(
        <div
          key={key}
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
            position: 'absolute', left: x, top: y,
            width: HEX_STEP_X - 6, height: HEX_STEP_Y + 12,
            display: 'grid', placeItems: 'center',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: dragOver === key ? 'rgba(79,227,255,0.3)'
              : selectedUnitId ? 'rgba(79,227,255,0.14)' : 'rgba(24,35,49,0.55)',
            border: 'none',
            outline: dragOver === key ? '2px solid var(--cyan)' : 'none',
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
                cursor: 'grab',
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
        background: 'linear-gradient(180deg, rgba(31,48,38,0.55) 0%, rgba(16,24,35,0.9) 100%)',
        borderRadius: 10, border: '2px solid #24384a',
      }} />
      <div style={{ position: 'absolute', top: 14, left: 20, color: 'var(--muted)', fontSize: 14 }}>
        준비 단계 — 유닛을 드래그해 배치하세요
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
    const scene = new BattleScene();
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
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !frames) return;
    doneRef.current = false;
    // The scene queues this itself when Phaser has not finished booting.
    scene.playBattle(frames, speed);
  }, [frames, speed]);

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
