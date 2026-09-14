import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { G1_THEMES } from '../src/game/engine/race-plan/profiles';

type Override = { id: string; nameJa: string; was: string; nameKo: string; evidence: 'verified' | 'pattern' };
const overrides = (JSON.parse(readFileSync('src/data/manual/g1-name-overrides.json', 'utf8')) as
  { overrides: Override[] }).overrides;
const vendored = (JSON.parse(readFileSync('src/data/source/race-templates.json', 'utf8')) as
  { templates: Array<{ id: string; nameJa: string; nameKo: string }> }).templates;
const extra = (JSON.parse(readFileSync('src/data/manual/g1-extra-themes.json', 'utf8')) as
  { templates: Array<{ id: string; nameJa: string; nameKo: string }> }).templates;

/**
 * These are real races, so their names are facts rather than copy. The source
 * list is vendored and re-synced, which means a correction to it silently
 * disappears; these keep the override layer honest instead.
 */
describe('GⅠ 경기 한국어 명칭', () => {
  it('오버라이드가 실제로 적용된다', () => {
    for (const o of overrides) {
      const theme = G1_THEMES.find((t) => t.id === o.id);
      expect(theme, `${o.id} is not a GⅠ theme`).toBeDefined();
      expect(theme!.nameKo, `${o.nameJa}`).toBe(o.nameKo);
    }
  });

  /** An override whose `was` no longer matches is one the upstream already fixed. */
  it('오버라이드는 실제로 바뀌는 이름에만 걸린다', () => {
    const upstream = new Map([...vendored, ...extra].map((t) => [t.id, t]));
    for (const o of overrides) {
      const source = upstream.get(o.id);
      expect(source, `${o.id} has no upstream entry to override`).toBeDefined();
      expect(source!.nameKo, `${o.id}: upstream is no longer "${o.was}" — 오버라이드를 재검토하세요`).toBe(o.was);
      expect(source!.nameJa, `${o.id}: nameJa drifted from the override`).toBe(o.nameJa);
      expect(o.nameKo).not.toBe(o.was);
    }
  });

  /**
   * Every race has to be traceable to its own Japanese name, which is what makes
   * a wrong Korean spelling findable at all.
   */
  it('모든 GⅠ가 한자 원문을 가진다', () => {
    const withJa = new Set([...vendored, ...extra].map((t) => t.id));
    for (const theme of G1_THEMES) expect(withJa.has(theme.id), `${theme.id} has no nameJa`).toBe(true);
  });

  it('경기 id와 이름이 중복되지 않는다', () => {
    expect(new Set(G1_THEMES.map((t) => t.id)).size).toBe(G1_THEMES.length);
    expect(new Set(G1_THEMES.map((t) => t.nameKo)).size).toBe(G1_THEMES.length);
  });

  /**
   * 賞 reads -상 and 記念 takes a space in Korean Uma Musume. Pinned so the two
   * conventions the override layer exists to enforce cannot quietly come apart.
   */
  it('賞은 -상, 記念은 띄어쓰기 규칙을 지킨다', () => {
    const upstream = new Map([...vendored, ...extra].map((t) => [t.id, t.nameJa]));
    for (const theme of G1_THEMES) {
      const ja = upstream.get(theme.id)!;
      if (/賞$/.test(ja) && !ja.startsWith('凱旋門')) {
        expect(theme.nameKo, `${ja} → ${theme.nameKo}`).not.toMatch(/쇼$/);
      }
      if (ja.endsWith('記念')) expect(theme.nameKo, `${ja} → ${theme.nameKo}`).toMatch(/ 기념$/);
    }
  });
});
