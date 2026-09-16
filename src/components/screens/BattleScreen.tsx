import { FormationFeedback } from '../FormationFeedback';
import { BattleAudio } from '../BattleAudio';
import { BattleMatchup } from '../BattleMatchup';
import { BattleLoading } from '../BattleLoading';
import { warmAssets } from '../../game/ui/warm-assets';
import { battleArtPlan } from '../../game/ui/battle-art-plan';
/** The main play screen: prep, battle playback and all HUD panels. */
import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TopHud, TraitPanel, ItemPanel, Leaderboard } from '../Panels';
import { ShopRow, BenchRow, ShopControls } from '../Shop';
import { ArenaBackdrop, PrepBoard, BattleBoard, BattleInspectTargets } from '../BoardView';
import { AugmentOverlay, DraftOverlay, BattleResultOverlay } from '../Overlays';
import { RacePlanOverlay } from '../race-plan/RacePlanOverlay';
import { G1EntryOverlay, FinishingMoveOverlay } from '../race-plan/G1EntryOverlay';
import { RaceProgressHud } from '../race-plan/RaceProgressHud';
import { RacePlanPanel } from '../race-plan/RacePlanPanel';
import { DetailPanel } from '../DetailPanel';
import { useInteractionStore } from '../../store/interactionStore';
import { useFieldFit } from '../../game/ui/use-field-fit';
import { handleBattleKey } from '../../game/ui/controls';
import { roundInfo } from '../../game/engine/rounds/schedule';
import type { UnitInstance } from '../../game/engine/state';
import { PromotionFeedback } from '../PromotionFeedback';
import { BattleTelemetry } from '../BattleTelemetry';
import { OnlineClock } from './OnlineScreen';
import { useOnlineStore } from '../../store/onlineStore';
import { useTouchDrag } from '../../game/ui/touch-drag';
import { PrepCountdown } from '../PrepCountdown';
import { WishlistPanel } from '../WishlistPanel';

export function BattleScreen(): JSX.Element | null {
  useTouchDrag();
  const online = useGameStore((s) => s.onlinePlayerId !== null);
  const frames = useGameStore((s) => s.viewedBattleFrames());
  const spectating = useGameStore(s => s.spectating);
  const viewed = useGameStore(s => s.viewedPlayer());
  const battleId = useGameStore((s) => s.onlineBattleId);
  const connected = useGameStore((s) => s.networkConnected);
  const match = useGameStore((s) => s.match);
  const human = useGameStore((s) => s.human());
  const battleRunning = useGameStore((s) => s.battleRunning);
  const startBattle = useGameStore((s) => s.startBattle);
  const finishBattle = useGameStore((s) => s.finishBattle);
  const setScreen = useGameStore((s) => s.setScreen);
  const exitToMainMenu = useGameStore(s => s.exitToMainMenu);
  const lastError = useGameStore((s) => s.lastError);
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  useGameStore((s) => s.revision);

  const inspection = useInteractionStore(s => s.inspection);
  const showResult = useGameStore((s) => s.battleComplete);
  const [arenaReady, setArenaReady] = useState(false);
  const onArenaReady = useCallback(() => setArenaReady(true), []);
  /**
   * The clock used to start the moment the battle did, while the arena was
   * still downloading the sheets it needed to draw it. On a 4Mbps connection
   * that was measured at 21.5s against an ~18s battle — the recording was over
   * before it was visible, which is why a fight appeared to be joined
   * mid-way with only the effects left.
   *
   * `introDone` is the real gate now: assets in, both sides walked on, then
   * time moves. Online is unaffected — its clock comes from the server and is
   * already excluded below.
   */
  const [introDone, setIntroDone] = useState(false);
  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const [loadProgress, setLoadProgress] = useState(0);
  const onLoadProgress = useCallback((fraction: number) => setLoadProgress(fraction), []);
  useEffect(() => {
    setArenaReady(false); setIntroDone(false); setLoadProgress(0);
  }, [battleRunning, spectating]);
  /**
   * The entrance now sits in front of the clock, so a path that never reports
   * it finished would freeze the battle outright — worse than the late start
   * it replaces. The scene caps the sequence at INTRO_TOTAL_MS + one landing,
   * so anything past a couple of seconds means the report was lost rather than
   * slow, and the battle should just begin.
   */
  useEffect(() => {
    if (!battleRunning || online || !arenaReady || introDone) return;
    const timer = window.setTimeout(() => setIntroDone(true), 2500);
    return () => window.clearTimeout(timer);
  }, [battleRunning, online, arenaReady, introDone]);

  // One match clock survives scouting switches; a short enemy battle cannot
  // settle the player’s longer fight early.
  useEffect(() => {
    if (!battleRunning || online || !introDone) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(), game = useGameStore.getState();
      const delta = (now - last) / 1000; last = now;
      if (game.battleComplete) return;
      const end = Math.max(0, ...[...(game.director?.playerFrames.values() ?? [])].map(f => f.at(-1)?.t ?? 0));
      const time = Math.min(end, game.battleTime + delta * game.settings.battleSpeed);
      game.setBattleTime(time);
      if (time >= end) game.completeBattle();
    }, 50);
    return () => window.clearInterval(timer);
  }, [battleRunning, online, introDone]);

  /**
   * Warm the coming battle's art while the player shops.
   *
   * Re-runs whenever the board, bench or shop changes, and `warmAssets` skips
   * anything already fetched, so a drag costs one new sheet rather than the
   * whole plan again. It is aborted the moment prep ends, so a battle never
   * waits behind a speculative download.
   */
  useEffect(() => {
    if (battleRunning || !human) return;
    const controller = new AbortController();
    void warmAssets(battleArtPlan(human), controller.signal);
    return () => controller.abort();
  }, [battleRunning, human]);

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
  const fieldFit = useFieldFit();

  if (!match || !human) return null;
  const info = roundInfo(match.stage, match.round);
  const awaitingAugment = match.augmentOffers.some((o) => o.playerId === human.id && o.chosen === null);
  const awaitingDraft = !!match.draft;
  const racePlan = human.racePlan;
  // The race plan owns the screen the same way an augment does: a pending offer,
  // or the entry screen before a unit has been registered.
  const awaitingRacePlan = Boolean(
    (racePlan?.currentOffer && racePlan.currentOffer.chosen === null)
    || (racePlan?.offerPhase === 'ENTRY' && !racePlan.entryUnitDefId),
  );
  const modalOpen = awaitingAugment || awaitingDraft || awaitingRacePlan || showResult;
  const exitButton = <button className="btn-ghost" onClick={exitToMainMenu}
    title="진행 상황을 저장하고 나갑니다. 전투 중에는 현재 전투를 정산합니다.">메인 메뉴</button>;

  return (
    <>
      <TopHud />
      <PromotionFeedback />
      <BattleAudio />

      <div className="hud-left scroll">
        <TraitPanel />
        <ItemPanel />
        <WishlistPanel />
      </div>

      <div className="hud-field" ref={fieldFit}><div className="field-surface">
        <ArenaBackdrop />
        <BattleMatchup />
        <FormationFeedback />
        {spectating && <div className="scouting-banner" role="status">{viewed?.name} · {battleRunning ? "전투 관전" : "필드 정찰"} <button onClick={() => useGameStore.getState().inspectPlayer(null)}>내 필드로 돌아가기</button></div>}
        {(!battleRunning || !arenaReady) && <PrepBoard onUnitContext={onUnitContext} />}
        {battleRunning && (!online || !!frames?.length) && <BattleBoard key={`${battleId ?? 'solo'}:${spectating ?? human.id}`} onReady={onArenaReady} onIntroDone={onIntroDone} onLoadProgress={onLoadProgress} />}
        {battleRunning && !arenaReady && <BattleLoading progress={loadProgress} />}
        {battleRunning && arenaReady && <BattleInspectTargets />}
        {battleRunning && arenaReady && <div className="race-hud-slot"><RaceProgressHud /></div>}
        {(!battleRunning || arenaReady) && <BattleTelemetry />}
        {online && !battleRunning && <OnlineClock />}
        {!online && !battleRunning && <PrepCountdown key={info.label} active={!awaitingAugment && !awaitingDraft && !awaitingRacePlan} seconds={info.prepSeconds} />}
      </div></div>

      <div className="hud-right scroll">
        <Leaderboard />{inspection ? <DetailPanel /> : <><RacePlanPanel /><div className="panel controls-help">
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
          {online && <span className="online-speed">1× · 서버 동기화</span>}
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
          {!online && !modalOpen && exitButton}
          {online && <button className="btn-ghost" onClick={() => { useOnlineStore.getState().leave(); setScreen('ONLINE'); }}>방 나가기</button>}
          <button className="btn-ghost" onClick={() => setScreen('COLLECTION')}>도감</button>
          <button className="btn-ghost" onClick={() => setScreen('SETTINGS')}>설정</button>
        </div>
      </div>

      {online && !connected && <div className="network-banner">연결이 끊어졌습니다 · 재접속 중 · 경기는 계속 진행됩니다</div>}
      {!online && modalOpen && <div className="solo-menu-exit">{exitButton}</div>}
      {lastError && <div className="toast">{lastError}</div>}
      {awaitingAugment && <AugmentOverlay />}
      {!awaitingAugment && awaitingRacePlan && racePlan?.offerPhase === 'ENTRY' && <G1EntryOverlay />}
      {!awaitingAugment && awaitingRacePlan && racePlan?.offerPhase === 'FINISHING' && <FinishingMoveOverlay />}
      {!awaitingAugment && awaitingRacePlan
        && (racePlan?.offerPhase === 'PLAN' || racePlan?.offerPhase === 'EVOLUTION') && <RacePlanOverlay />}
      {awaitingDraft && !awaitingAugment && !awaitingRacePlan && <DraftOverlay />}
      {showResult && <BattleResultOverlay onContinue={handleContinue} />}
    </>
  );
}
