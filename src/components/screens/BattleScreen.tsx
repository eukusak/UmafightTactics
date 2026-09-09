/** The main play screen: prep, battle playback and all HUD panels. */
import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TopHud, TraitPanel, ItemPanel, Leaderboard, OpponentBoardPeek } from '../Panels';
import { ShopRow, BenchRow, ShopControls } from '../Shop';
import { ArenaBackdrop, PrepBoard, BattleBoard, BattleInspectTargets } from '../BoardView';
import { AugmentOverlay, DraftOverlay, BattleResultOverlay } from '../Overlays';
import { DetailPanel } from '../DetailPanel';
import { useInteractionStore } from '../../store/interactionStore';
import { handleBattleKey } from '../../game/ui/controls';
import { roundInfo } from '../../game/engine/rounds/schedule';
import type { UnitInstance } from '../../game/engine/state';
import { PromotionFeedback } from '../PromotionFeedback';
import { BattleTelemetry } from '../BattleTelemetry';
import { OnlineClock } from './OnlineScreen';
import { useOnlineStore } from '../../store/onlineStore';
import { PrepCountdown } from '../PrepCountdown';

export function BattleScreen(): JSX.Element | null {
  const online = useGameStore((s) => s.onlinePlayerId !== null);
  const frames = useGameStore((s) => s.battleFrames);
  const battleId = useGameStore((s) => s.onlineBattleId);
  const connected = useGameStore((s) => s.networkConnected);
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

  const inspection = useInteractionStore(s => s.inspection);
  const showResult = useGameStore((s) => s.battleComplete);
  const [arenaReady, setArenaReady] = useState(false);
  const onArenaReady = useCallback(() => setArenaReady(true), []);
  useEffect(() => { if (!battleRunning) setArenaReady(false); }, [battleRunning]);

  const onUnitContext = useCallback((e: React.MouseEvent, unit: UnitInstance) => {
    e.preventDefault();
    const player = useGameStore.getState().human();
    if (player) useInteractionStore.getState().inspect({ kind: 'unit', id: unit.instanceId, playerId: player.id });
  }, []);

  const onPlaybackFinished = useCallback(() => useGameStore.getState().completeBattle(), []);

  const handleContinue = useCallback(() => {
    finishBattle();
  }, [finishBattle]);

  // Keyboard shortcuts (spec §27.3).
  useEffect(() => {
    useInteractionStore.getState().reset();
    const cancelDrag = () => useInteractionStore.getState().drag(null);
    const blur = () => { cancelDrag(); useInteractionStore.getState().hover(null); };
    window.addEventListener('keydown', handleBattleKey);
    window.addEventListener('dragend', cancelDrag);
    window.addEventListener('drop', cancelDrag);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', handleBattleKey);
      window.removeEventListener('dragend', cancelDrag);
      window.removeEventListener('drop', cancelDrag);
      window.removeEventListener('blur', blur);
      useInteractionStore.getState().reset();
    };
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
        {battleRunning && (!online || !!frames?.length) && <BattleBoard key={battleId ?? 'solo'} onFinished={onPlaybackFinished} onReady={onArenaReady} />}
        {battleRunning && arenaReady && <BattleInspectTargets />}
        {(!battleRunning || arenaReady) && <BattleTelemetry />}
        {online && !battleRunning && <OnlineClock />}
        {!online && !battleRunning && <PrepCountdown key={info.label} active={!awaitingAugment && !awaitingDraft} seconds={info.prepSeconds} />}
      </div>

      <div className="hud-right scroll">
        {inspection ? <DetailPanel /> : <><Leaderboard /><OpponentBoardPeek /><div className="panel controls-help">
          <strong>조작 안내</strong><p>기물·특성·아이템 클릭: 상세 정보</p>
          <p>기물을 상점으로 드래그: 판매</p><p>{settings.keybinds.sellHovered.toUpperCase()}: 가리킨 기물 판매 · {settings.keybinds.toggleBench.toUpperCase()}: 필드/대기석</p>
          <p>{settings.keybinds.battleInfo}: 전투 통계 · Esc: 선택 취소/닫기</p>
        </div></>}
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
          {battleRunning && !online && (
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
          {!online && !battleRunning && !awaitingAugment && !awaitingDraft && (
            <button className="btn-primary" onClick={() => { startBattle(); }}>
              전투 시작 ({info.kind === 'PVE' ? 'PvE' : 'PvP'})
            </button>
          )}
          {online && <button className="btn-ghost" onClick={() => { useOnlineStore.getState().leave(); setScreen('ONLINE'); }}>방 나가기</button>}
          <button className="btn-ghost" onClick={() => setScreen('COLLECTION')}>도감</button>
          <button className="btn-ghost" onClick={() => setScreen('SETTINGS')}>설정</button>
        </div>
      </div>

      {online && !connected && <div className="network-banner">연결이 끊어졌습니다 · 재접속 중 · 경기는 계속 진행됩니다</div>}
      {lastError && <div className="toast">{lastError}</div>}
      {awaitingAugment && <AugmentOverlay />}
      {awaitingDraft && !awaitingAugment && <DraftOverlay />}
      {showResult && <BattleResultOverlay onContinue={handleContinue} />}
    </>
  );
}
