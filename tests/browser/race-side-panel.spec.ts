import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import { preparedGame } from './fixtures';

async function open(page: Page, mode: string) {
  const save = execFileSync(process.execPath, ['--import', 'tsx', 'tests/support/browser-save.ts', mode], { encoding: 'utf8' }).trim();
  await page.goto('/');
  await page.evaluate(s => localStorage.setItem('uma-fight-tactics-save-v1', s), save);
  await page.reload();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '이어하기' }).click();
}

/**
 * The prep-phase side panel is where a player learns what the race is doing to
 * them. The pace bends every 각질 curve on the board and nothing else on screen
 * says so, so if this panel goes quiet the mechanic becomes invisible.
 */
test('side panel explains the GⅠ, the ground and the board\'s 각질', async ({ page }) => {
  // 'arena-day' sits in a prep phase with no race dialog covering the panel.
  await open(page, 'arena-day');
  const panel = page.locator('.race-panel-side');
  await expect(panel).toBeVisible({ timeout: 15000 });

  // The GⅠ and its 과제.
  await expect(panel).toContainText('이번 로비의 목표는');
  // The round's ground, all three always-present axes on one line.
  await expect(panel).toContainText('이번 라운드는 마장');
  await expect(panel).toContainText(/양호|약간 습윤|습윤|불량/);
  await expect(panel).toContainText(/하이페이스|미들페이스|슬로우페이스/);

  const going = panel.locator('summary', { hasText: '오늘의 마장 읽기' });
  await expect(going).toBeVisible();
  await going.click();
  // Every axis gets a note, not just a label.
  await expect(panel.locator('.race-effects li')).not.toHaveCount(0);

  const styles = panel.locator('summary', { hasText: '내 보드의 각질' });
  await expect(styles).toBeVisible();
  await styles.click();
  await expect(panel).toContainText(/도주|선행|선입|추입/);

  // The panel lives in a narrow column; it must never scroll sideways.
  expect(await panel.evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
});

test('the GⅠ, the ground and the plan are on the top line from the very first round', async ({ page }, testInfo) => {
  await preparedGame(page, 'default');
  const strip = page.locator('.race-top-strip');
  await expect(strip).toBeVisible();
  /**
   * All three used to live only in the side panel, which sits under an
   * eight-row leaderboard in a column that overflows at 1080p — so the check
   * that matters is not "is it in the DOM" but "is it on screen without
   * scrolling anything", at 1-1, before any plan has been chosen.
   */
  const seen = await strip.evaluate((e: HTMLElement) => {
    const box = e.getBoundingClientRect();
    const top = document.querySelector('.hud-top')!.getBoundingClientRect();
    return {
      text: e.textContent ?? '',
      insideTopHud: box.top >= top.top - 1 && box.bottom <= top.bottom + 1,
      onScreen: box.top >= 0 && box.bottom <= window.innerHeight && box.width > 0,
      chips: e.querySelectorAll('.race-chip').length,
    };
  });
  expect(seen.insideTopHud).toBe(true);
  expect(seen.onScreen).toBe(true);
  expect(seen.chips).toBe(3);
  expect(seen.text).toContain('이번 로비의 목표');
  expect(seen.text).toContain('오늘의 마장');
  expect(seen.text).toContain('내 작전');
  // Nothing is chosen yet at 1-1, so the plan chip says when the choice comes.
  expect(seen.text).toMatch(/\d-\d에 작전 선택/);
  await page.locator('.hud-top').screenshot({ path: testInfo.outputPath('race-top-strip.png') });
});

test('choosing a plan puts its name and a plain-language line where the player can see them', async ({ page }) => {
  await open(page, 'race-plan');
  const card = page.locator('.race-card').first();
  // The card leads with what it does, before the flavour line.
  const plainly = await card.locator('.race-plainly').textContent();
  expect(plainly).toMatch(/힘이 실립니다/);
  const name = await card.locator('h3').textContent();
  await card.locator('.race-take').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const strip = await page.locator('.race-chip-plan').textContent();
  expect(strip).toContain(name!);
  expect(strip).toContain(plainly!.split(' · ')[0]);

  const panel = page.locator('.race-side-chosen');
  await expect(panel).toBeVisible();
  expect(await panel.textContent()).toContain(name!);
  // The exact numbers are open, not behind a click.
  const openDetails = await page.locator('.race-panel-side details[open] .race-effects li').count();
  expect(openDetails).toBeGreaterThan(0);
});
