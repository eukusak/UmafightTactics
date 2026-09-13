import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';

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
