import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SEASON_THEMES, SEASON_TRAIT_DEFS } from '../src/game/engine/seasons/catalog';

/** Code-native faction emblems: season color, numbered stars and distinct glyphs. */
export function writeSeasonIcons(root: string): void {
  const glyphs = [
    'M20 35 30 16 29 29 43 25 32 46 33 33Z',
    'M20 20 32 15 44 20V31Q44 42 32 48Q20 42 20 31Z M26 30 31 35 39 25',
    'M32 15 36 26 48 30 37 35 32 47 27 35 16 30 28 26Z',
    'M18 23 25 30 32 19 39 30 46 23 42 43H22Z M24 38H40',
  ];
  const out = path.join(root, 'public/assets/traits');
  mkdirSync(out, { recursive: true });
  for (const [index, theme] of SEASON_THEMES.entries()) {
    SEASON_TRAIT_DEFS.filter(t => t.id.startsWith(`${theme.id}_`)).forEach((trait, i) => {
      const dots = Array.from({ length: index + 1 }, (_, d) => `<circle cx="${32 + (d - index / 2) * 6}" cy="55" r="1.5" fill="${theme.color}"/>`).join('');
      writeFileSync(path.join(out, `${trait.id}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>${trait.name}</title><rect x="2" y="2" width="60" height="60" rx="14" fill="#142c3d" stroke="${theme.color}" stroke-width="2"/><path d="${glyphs[i]}" fill="${theme.color}22" stroke="${theme.color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>\n`, 'utf8');
    });
  }
}
