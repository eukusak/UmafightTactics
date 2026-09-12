import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('final results retain all eight nine-unit fields, stars and equipment', async ({ page }, info) => {
  await preparedGame(page, 'result-victory');
  await expect(page.getByRole('heading', { name: '경기 결과' })).toBeVisible();
  await expect(page.locator('.result-player')).toHaveCount(8);
  await expect(page.locator('.result-unit')).toHaveCount(72);
  await expect(page.locator('.result-your-place')).toHaveText('1위');
  await expect(page.getByText('진행 중', { exact: false })).toHaveCount(0);
  const champion = page.locator('.result-player.is-human');
  await expect(champion.locator('.result-unit').first()).toHaveAttribute('aria-label', /3성 · 아이템 3개/);
  await champion.locator('.result-unit').first().click();
  await expect(page.locator('.result-unit-detail')).toBeVisible();
  await expect(page.locator('.result-item-detail')).toHaveCount(3);
  await expect(page.locator('.result-unit img').first()).toBeVisible();
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('.result-unit img')).every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: info.outputPath('result-victory.png'), fullPage: true });
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await expect(page.locator('.results-layout')).toHaveCount(0);
});

test('elimination result freezes surviving fields and reloads at the same round on mobile', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparedGame(page, 'result-eliminated');
  await expect(page.locator('.result-player')).toHaveCount(8);
  await expect(page.locator('.result-unit')).toHaveCount(72);
  await expect(page.locator('.result-your-place')).toHaveText('8위');
  await expect(page.locator('.result-player-info span').filter({ hasText: '진행 중' })).toHaveCount(7);
  await expect(page.locator('.results-heading')).toContainText('탈락 시점 1-1 기준');
  const before = await page.locator('.result-roster').innerText();
  await page.reload();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '이어하기' }).click();
  await expect(page.locator('.result-roster')).toHaveText(before, { useInnerText: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: info.outputPath('result-eliminated-mobile.png'), fullPage: true });
  await page.locator('.result-player.is-human .result-unit').first().click();
  await expect(page.locator('.result-unit-detail')).toContainText('3성');
});
