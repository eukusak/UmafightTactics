import type { CarouselPoint, CarouselState, DraftState, MatchState } from '../state';
import { getUnitDef } from '../roster';
import { pickDraftOption } from './draft';

export const CAROUSEL = { width: 1100, height: 650, cx: 550, cy: 325, rx: 270, ry: 180,
  speed: 210, rotation: .22, contact: 28, tick: 50, countdown: 2500, releaseGap: 4500, autoAfter: 12000, finishDelay: 1200 } as const;

export function carouselPosition(index: number, count: number, angle: number): CarouselPoint {
  const a = angle + index * Math.PI * 2 / Math.max(1, count);
  return { x: CAROUSEL.cx + Math.cos(a) * CAROUSEL.rx, y: CAROUSEL.cy + Math.sin(a) * CAROUSEL.ry };
}

export function createCarousel(draft: DraftState, opening: boolean): CarouselState {
  return { elapsed: 0, remainder: 0, angle: 0, completedAt: null, avatars: draft.order.map((playerId, i) => {
    const a = i * Math.PI * 2 / draft.order.length;
    const home = { x: CAROUSEL.cx + Math.cos(a) * 455, y: CAROUSEL.cy + Math.sin(a) * 225 };
    const picked = draft.options.find(o => o.takenBy === playerId)?.index ?? null;
    return { playerId, ...home, home, target: { ...home }, targetOption: null, picked,
      releaseAt: CAROUSEL.countdown + (opening ? 0 : Math.floor(i / 2) * CAROUSEL.releaseGap) };
  }) };
}

/** A target is an intention, never a client-supplied position or claim. */
export function setCarouselTarget(state: MatchState, playerId: string, target: CarouselPoint, option: number | null = null): boolean {
  const draft = state.draft, c = draft?.carousel;
  const avatar = c?.avatars.find(a => a.playerId === playerId);
  if (!draft || !c || !avatar || avatar.picked !== null || c.completedAt !== null
    || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
  if (option !== null && !draft.options.some(o => o.index === option && !o.takenBy)) return false;
  avatar.target = { x: Math.max(35, Math.min(CAROUSEL.width - 35, target.x)), y: Math.max(35, Math.min(CAROUSEL.height - 35, target.y)) };
  avatar.targetOption = option;
  return true;
}

const distance = (a: CarouselPoint, b: CarouselPoint) => Math.hypot(a.x - b.x, a.y - b.y);
function move(a: CarouselPoint, target: CarouselPoint, amount: number): void {
  const d = distance(a, target), ratio = Math.min(1, amount / Math.max(.001, d));
  a.x += (target.x - a.x) * ratio; a.y += (target.y - a.y) * ratio;
}

/** Fixed ticks make collisions independent of client FPS, latency and command frequency. */
export function advanceCarousel(state: MatchState, delta: number): boolean {
  const draft = state.draft, c = draft?.carousel;
  if (!draft || !c || !Number.isFinite(delta) || delta <= 0) return false;
  c.remainder += Math.min(delta, 60000);
  while (c.remainder >= CAROUSEL.tick) {
    c.remainder -= CAROUSEL.tick; c.elapsed += CAROUSEL.tick;
    c.angle = c.elapsed / 1000 * CAROUSEL.rotation;
    for (const avatar of c.avatars) {
      if (avatar.picked !== null) { move(avatar, avatar.home, CAROUSEL.speed * .05); continue; }
      if (c.elapsed < avatar.releaseAt) continue;
      const player = state.players.find(p => p.id === avatar.playerId)!;
      const auto = player.aiProfile !== null || c.elapsed >= avatar.releaseAt + CAROUSEL.autoAfter;
      const available = draft.options.filter(o => !o.takenBy);
      if (auto && (avatar.targetOption === null || !available.some(o => o.index === avatar.targetOption))) {
        const best = available.sort((a, b) => {
          const score = (o: typeof a) => getUnitDef(o.unitDefId).cost * 35 + getUnitDef(o.unitDefId).uftRating * 5
            - distance(avatar, carouselPosition(o.index, draft.options.length, c.angle)) * .12;
          return score(b) - score(a) || a.index - b.index;
        })[0];
        avatar.targetOption = best?.index ?? null;
      }
      if (avatar.targetOption !== null) {
        const option = draft.options.find(o => o.index === avatar.targetOption && !o.takenBy);
        if (option) avatar.target = carouselPosition(option.index, draft.options.length, c.angle);
        else { avatar.targetOption = null; avatar.target = { x: avatar.x, y: avatar.y }; }
      }
      move(avatar, avatar.target, CAROUSEL.speed * .05);
    }
    // Resolve nearest contact first. Seeded seat order breaks exact simultaneous ties.
    const contacts = c.avatars.flatMap((avatar, rank) => avatar.picked !== null || c.elapsed < avatar.releaseAt ? [] :
      draft.options.filter(o => !o.takenBy).map(option => ({ avatar, option, rank,
        distance: distance(avatar, carouselPosition(option.index, draft.options.length, c.angle)) }))
        .filter(hit => hit.distance <= CAROUSEL.contact));
    contacts.sort((a, b) => a.distance - b.distance || a.rank - b.rank || a.option.index - b.option.index);
    for (const hit of contacts) {
      if (hit.avatar.picked !== null || hit.option.takenBy) continue;
      if (pickDraftOption(state, state.players.find(p => p.id === hit.avatar.playerId)!, hit.option.index, true).ok) {
        hit.avatar.picked = hit.option.index; hit.avatar.targetOption = null;
      }
    }
    if (c.avatars.every(a => a.picked !== null)) c.completedAt ??= c.elapsed;
    if (c.completedAt !== null && c.elapsed - c.completedAt >= CAROUSEL.finishDelay) return true;
  }
  return false;
}
