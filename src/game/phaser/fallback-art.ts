/**
 * Procedural fallback art (spec §35).
 *
 * The game must be completable with zero PNGs delivered. Every asset key first
 * tries the real file; when it is missing we generate a readable placeholder
 * once and cache it. Each missing key is logged exactly once.
 */
import { ART_COLORS } from '../ui/palette';

const loggedMissing = new Set<string>();

export function noteMissingAsset(key: string): void {
  if (loggedMissing.has(key)) return;
  loggedMissing.add(key);
  console.info(`[art] using fallback for "${key}" (asset not delivered yet)`);
}

export function missingAssetKeys(): string[] {
  return [...loggedMissing].sort();
}

const COST_COLORS: Record<number, string> = {
  1: ART_COLORS.cost1,
  2: ART_COLORS.cost2,
  3: ART_COLORS.cost3,
  4: ART_COLORS.cost4,
  5: ART_COLORS.cost5,
};

export const costColor = (cost: number): string => COST_COLORS[cost] ?? ART_COLORS.cost1;

const canvasCache = new Map<string, HTMLCanvasElement>();

function makeCanvas(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cached = canvasCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
  }
  canvasCache.set(key, canvas);
  return canvas;
}

/** First grapheme of a Korean name, used as the unit's fallback glyph. */
export function initialOf(name: string): string {
  return Array.from(name)[0] ?? '?';
}

/** Circular unit token: cost-coloured ring, dark body, first character. */
export function unitTokenCanvas(
  nameKo: string, cost: number, star: number, size = 96,
): HTMLCanvasElement {
  return makeCanvas(`unit:${nameKo}:${cost}:${star}:${size}`, size, size, (ctx) => {
    const r = size / 2;
    ctx.fillStyle = ART_COLORS.panel;
    ctx.beginPath();
    ctx.arc(r, r, r - 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = costColor(cost);
    ctx.beginPath();
    ctx.arc(r, r, r - 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = ART_COLORS.text;
    ctx.font = `bold ${Math.floor(size * 0.44)}px "Noto Sans KR", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialOf(nameKo), r, r + size * 0.02);

    // Star pips along the top edge.
    if (star > 1) {
      ctx.fillStyle = star >= 3 ? ART_COLORS.gold : ART_COLORS.text;
      const pip = Math.max(3, size * 0.055);
      const total = star * pip * 2.4;
      for (let i = 0; i < star; i += 1) {
        const x = r - total / 2 + pip * 1.2 + i * pip * 2.4;
        ctx.beginPath();
        ctx.arc(x, size * 0.13, pip, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** Square item token: tag-tinted frame with a short abbreviation. */
export function itemTokenCanvas(label: string, tint: string, size = 48): HTMLCanvasElement {
  return makeCanvas(`item:${label}:${tint}:${size}`, size, size, (ctx) => {
    ctx.fillStyle = ART_COLORS.panelBright;
    ctx.fillRect(2, 2, size - 4, size - 4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = tint;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.fillStyle = ART_COLORS.text;
    ctx.font = `bold ${Math.floor(size * 0.36)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.slice(0, 2), size / 2, size / 2);
  });
}

export function toDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/** Probe an asset URL once; resolves false when it is missing. */
const probeCache = new Map<string, Promise<boolean>>();

export function assetExists(url: string): Promise<boolean> {
  const cached = probeCache.get(url);
  if (cached) return cached;
  const promise = new Promise<boolean>((resolve) => {
    if (typeof Image === 'undefined') { resolve(false); return; }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => { noteMissingAsset(url); resolve(false); };
    img.src = url;
  });
  probeCache.set(url, promise);
  return promise;
}
