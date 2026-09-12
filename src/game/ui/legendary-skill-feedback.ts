import type Phaser from 'phaser';
export const LEGENDARY_FEEDBACK_SECONDS = .36;

/** Deliberately limited to the two reviewed, visually quiet releases. */
export function legendaryFeedback(id: string, cost: number, age: number) {
  if (cost !== 5 || age < 0 || age >= LEGENDARY_FEEDBACK_SECONDS) return null;
  const kind = id === 'buena_vista' ? 'finisher' : id === 'taiki_shuttle' ? 'chain' : null;
  return kind ? { kind, progress: age / LEGENDARY_FEEDBACK_SECONDS, alpha: 1 - age / LEGENDARY_FEEDBACK_SECONDS } : null;
}
type Point = { x: number; y: number };

/** Only draw toward recorded targets; these trails never add hits or delay damage. */
export function drawLegendaryFeedback(g: Phaser.GameObjects.Graphics, id: string, cost: number, origin: Point, targets: Point[], age: number, scale = 1): void {
  const cue = legendaryFeedback(id, cost, age);
  if (!cue || !targets.length) return;
  const { progress: p, alpha } = cue;
  const gold = 0xffd178;
  let from = origin;
  for (const end of cue.kind === 'finisher' ? targets.slice(0, 1) : targets) {
    if (cue.kind === 'chain') {
      const dx = end.x - from.x, dy = end.y - from.y, length = Math.max(1, Math.hypot(dx, dy));
      g.lineStyle(3 * scale, gold, alpha).beginPath().moveTo(from.x, from.y);
      for (let step = 1; step <= 8; step++) {
        const t = step / 8, wobble = step === 8 ? 0 : (step % 2 ? 1 : -1) * 7 * scale * (1 - p);
        g.lineTo(from.x + dx * t - dy / length * wobble, from.y + dy * t + dx / length * wobble);
      }
      g.strokePath();
      g.lineStyle(scale, 0xff96ac, alpha).strokeCircle(end.x, end.y, (6 + p * 19) * scale);
      g.fillStyle(0xfff5d9, alpha).fillCircle(from.x + dx * p, from.y + dy * p, 4 * scale);
    } else {
      g.lineStyle(scale, gold, alpha * .45).lineBetween(origin.x, origin.y, end.x, end.y);
      const reach = (9 + p * 24) * scale;
      g.lineStyle(3 * scale, 0xffefbb, alpha);
      g.lineBetween(end.x - reach, end.y + reach, end.x + reach, end.y - reach);
      g.lineBetween(end.x - reach * .7, end.y - reach * .7, end.x + reach * .7, end.y + reach * .7);
      g.lineStyle(scale, gold, alpha * .8).strokeCircle(end.x, end.y, (28 - p * 16) * scale);
    }
    from = end;
  }
}
