/** The main play screen: prep, battle playback and all HUD panels. */
import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TopHud, TraitPanel, ItemPanel, Leaderboard, OpponentBoardPeek } from '../Panels';
import { ShopRow, BenchRow, ShopControls } from '../Shop';
import { ArenaBackdrop, PrepBoard, BattleBoard } from '../BoardView';
import { AugmentOverlay, DraftOverlay, BattleResultOverlay, DevPanel } from '../Overlays';
import { Tooltip } from '../common';
import { UnitTooltip } from '../UnitTooltip';
import { roundInfo } from '../../game/engine/rounds/schedule';
import type { UnitInstance } from '../../game/engine/state';
import { PromotionFeedback } from '../PromotionFeedback';
import { PrepCountdown } from '../PrepCountdown';

export function BattleScreen(): JSX.Element | null {
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  const battleRunning = useGameStore((s) => s.battleRunning);
  const startBattle = useGameStore((s) => s.startBattle);
  const finishBattle = useGameStore((s) => s.finishBattle);
  const setScreen = useGameStore((s) => s.setScreen);
  const lastError = useGameStore((s) => s.lastError);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  useGameStore((s) => s.revision);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; unit: UnitInstance } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [arenaReady, setArenaReady] = useState(false);
  const onArenaReady = useCallback(() => setArenaReady(true), []);
  useEffect(() => { if (!battleRunning) setArenaReady(false); }, [battleRunning]);

  const onUnitContext = useCallback((e: React.MouseEvent, unit: UnitInstance) => {
    setTooltip({ x: e.clientX, y: e.clientY, unit });
  }, []);

  const onPlaybackFinished = useCallback(() => setShowResult(true), []);

  const handleContinue = useCallback(() => {
    setShowResult(false);
    finishBattle();
  }, [finishBattle]);

  // Keyboard shortcuts (spec §27.3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const store = useGameStore.getState();
      const binds = store.settings.keybinds;
      const key = e.key;
      if (key === binds.reroll) { store.reroll(); e.preventDefault(); }
      else if (key === binds.buyXp) { store.buyExperience(); e.preventDefault(); }
      else if (key === binds.prevPlayer) store.spectate(-1);
      else if (key === binds.nextPlayer) store.spectate(1);
      else if (key === binds.settings) store.setScreen('SETTINGS');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!match || !human) return null;
  const info = roundInfo(match.stage, match.round);
  const awaitingAugment = match.augmentOffers.some((o) => o.playerId === human.id && o.chosen === null);
  const awaitingDraft = !!match.draft;

  return (
    <>
      <TopHud />
      <PromotionFeedback />

      <div className="hud-left scroll">
        <TraitPanel />
        <ItemPanel />
      </div>

      <div className="hud-field">
        <ArenaBackdrop />
        {(!battleRunning || !arenaReady) && <PrepBoard onUnitContext={onUnitContext} />}
        {battleRunning && <BattleBoard onFinished={onPlaybackFinished} onReady={onArenaReady} />}
        {!battleRunning && <PrepCountdown key={info.label} active={!awaitingAugment && !awaitingDraft} seconds={info.prepSeconds} />}
      </div>

      <div className="hud-right scroll">
        <Leaderboard />
        <OpponentBoardPeek />
      </div>

      <div className="hud-bench">
        <BenchRow onUnitContext={onUnitContext} />
      </div>

      <div className="hud-shop">
        <ShopRow />
      </div>

      <div className="hud-footer">
        <ShopControls />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {battleRunning && (
            <>
              {[1, 2, 4, 10].map((s) => (
                <button
                  key={s}
                  className={settings.battleSpeed === s ? 'btn-primary' : 'btn-ghost'}
                  onClick={() => setSettings({ battleSpeed: s as 1 | 2 | 4 | 10 })}
                >
                  {s}×
                </button>
              ))}
              <button className="btn-ghost" onClick={onPlaybackFinished}>전투 건너뛰기</button>
            </>
          )}
          {!battleRunning && !awaitingAugment && !awaitingDraft && (
            <button className="btn-primary" onClick={() => { startBattle(); }}>
              전투 시작 ({info.kind === 'PVE' ? 'PvE' : 'PvP'})
            </button>
          )}
          <button className="btn-ghost" onClick={() => setScreen('COLLECTION')}>도감</button>
          <button className="btn-ghost" onClick={() => setScreen('SETTINGS')}>설정</button>
        </div>
      </div>

      {lastError && <div className="toast">{lastError}</div>}
      {awaitingAugment && <AugmentOverlay />}
      {awaitingDraft && !awaitingAugment && <DraftOverlay />}
      {showResult && <BattleResultOverlay onContinue={handleContinue} />}
      {tooltip && (
        <Tooltip x={tooltip.x} y={tooltip.y} onClose={() => setTooltip(null)}>
          <UnitTooltip unit={tooltip.unit} />
        </Tooltip>
      )}
      <DevPanel />
    </>
  );
}
