import Phaser from 'phaser';

/** Phaser 3.90's VisibilityHandler leaves its document listener after destroy.
 * Keep the documented Game.start lifecycle, but own and remove browser listeners.
 * Recheck this small override when upgrading Phaser (core/Game.js start).
 */
export class ManagedGame extends Phaser.Game {
  // The base marks this read-only for callers; Game.start is its writer.
  declare isRunning: boolean;
  protected override start(): void {
    this.isRunning = true;
    this.config.postBoot(this);
    this.loop.start(this.renderer ? this.step.bind(this) : this.headlessStep.bind(this));

    const events = Phaser.Core.Events;
    const visibility = (): void => { this.events.emit(document.hidden ? events.HIDDEN : events.VISIBLE); };
    const blur = (): void => { this.events.emit(events.BLUR); };
    const focus = (): void => { this.events.emit(events.FOCUS); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    this.events.once(events.DESTROY, () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    });
    if (this.config.autoFocus) window.focus();
    this.events.on(events.HIDDEN, this.onHidden, this);
    this.events.on(events.VISIBLE, this.onVisible, this);
    this.events.on(events.BLUR, this.onBlur, this);
    this.events.on(events.FOCUS, this.onFocus, this);
  }
}
