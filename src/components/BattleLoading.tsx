/**
 * Covers the arena while it loads.
 *
 * The board behind this is the prep board, frozen mid-round — without a cover
 * the player cannot tell whether the battle is loading or the click was
 * swallowed. Phaser's loader drives the bar, so the fraction is what is
 * actually downloaded rather than a timed animation pretending to be one.
 */
export function BattleLoading({ progress }: { progress: number }): JSX.Element {
  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <div className="battle-loading" role="status" aria-live="polite" aria-label={`전투 준비 ${percent}%`}>
      <div className="battle-loading-gate">
        <span className="battle-loading-title">게이트 입장</span>
        <div className="battle-loading-track">
          <div className="battle-loading-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="battle-loading-percent">{percent}%</span>
      </div>
    </div>
  );
}
