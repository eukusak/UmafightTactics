/**
 * Deterministic xorshift32 PRNG with named, independently-derived streams.
 *
 * Spec §31 / §42: `Math.random()` is banned everywhere in the game. Every random
 * decision routes through an Rng whose state lives inside MatchState, so a match
 * replays identically from its seed.
 */

export function nextUint32(state: number): number {
  let x = state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

/** FNV-1a over a string; used to derive a stream seed from its name. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Derives a stream seed from a match seed plus a stream name so that the number
 * of calls made on one stream can never shift another stream's results.
 */
export function deriveSeed(matchSeed: number, streamName: string): number {
  let s = (matchSeed >>> 0) ^ hashString(streamName);
  if (s === 0) s = 0x9e3779b9;
  // Discard a few states so neighbouring seeds diverge immediately.
  for (let i = 0; i < 8; i += 1) s = nextUint32(s);
  return s >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    const s = seed >>> 0;
    this.state = s === 0 ? 0x9e3779b9 : s;
  }

  static forStream(matchSeed: number, streamName: string): Rng {
    return new Rng(deriveSeed(matchSeed, streamName));
  }

  getState(): number {
    return this.state >>> 0;
  }

  setState(state: number): void {
    const s = state >>> 0;
    this.state = s === 0 ? 0x9e3779b9 : s;
  }

  clone(): Rng {
    return new Rng(this.state);
  }

  nextUint32(): number {
    this.state = nextUint32(this.state);
    return this.state;
  }

  /** Uniform in [0, 1). */
  next(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  /** Uniform integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) return minInclusive;
    const span = maxExclusive - minInclusive;
    return minInclusive + (this.nextUint32() % span);
  }

  bool(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called on an empty array');
    return items[this.int(0, items.length)];
  }

  /** Fisher-Yates over a copy; never mutates the input. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i + 1);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** Picks an index proportional to `weights`. Returns -1 when every weight is 0. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return -1;
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      roll -= Math.max(0, weights[i]);
      if (roll < 0) return i;
    }
    for (let i = weights.length - 1; i >= 0; i -= 1) {
      if (weights[i] > 0) return i;
    }
    return -1;
  }

  /** Picks `count` distinct entries without replacement. */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.min(count, items.length));
  }
}

/** Every stream the game uses. Keeping them named makes save/restore explicit. */
export type StreamName =
  | 'match'
  | 'shop'
  | 'draft'
  | 'loot'
  | 'augment'
  | 'pve'
  | 'matchmaking'
  | `battle-pair-${number}`
  | `ai-${number}`;

export class RngRegistry {
  private readonly streams = new Map<string, Rng>();

  constructor(private readonly matchSeed: number) {}

  get(name: StreamName | string): Rng {
    let rng = this.streams.get(name);
    if (!rng) {
      rng = Rng.forStream(this.matchSeed, name);
      this.streams.set(name, rng);
    }
    return rng;
  }

  /** A throwaway stream derived from a name; useful for one-shot deterministic draws. */
  ephemeral(name: string): Rng {
    return Rng.forStream(this.matchSeed, name);
  }

  serialize(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, rng] of this.streams) out[name] = rng.getState();
    return out;
  }

  restore(states: Record<string, number>): void {
    this.streams.clear();
    for (const [name, state] of Object.entries(states)) {
      this.streams.set(name, new Rng(state));
    }
  }

  get seed(): number {
    return this.matchSeed;
  }
}
