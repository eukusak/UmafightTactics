import { test, expect, type Page, type Locator } from '@playwright/test';
import { preparedGame } from './fixtures';

async function drag(page: Page, source: Locator, destination: Locator) {
  const a = (await source.boundingBox())!, b = (await destination.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 }); await page.mouse.up();
}

test('mouse placement swaps occupied hexes through tall artwork and tools consume charges', async ({ page }) => {
  await preparedGame(page, 'patch-tools');
  const first = page.locator('.bench-slot.filled').first(), firstId = await first.getAttribute('data-unit-id');
  const c1 = page.locator('.arena-cell[data-q="3"][data-r="3"]'), c2 = page.locator('.arena-cell[data-q="3"][data-r="2"]');
  await drag(page, first, c1);
  const second = page.locator('.bench-slot.filled').first(), secondId = await second.getAttribute('data-unit-id');
  await drag(page, second, c2);
  const u1 = page.locator(`[data-touch-unit="${firstId}"]`), u2 = page.locator(`[data-touch-unit="${secondId}"]`);
  await expect(u1).toHaveAttribute('data-r', '3'); await expect(u2).toHaveAttribute('data-r', '2');
  await drag(page, u1, c2);
  await expect(u1).toHaveAttribute('data-r', '2'); await expect(u2).toHaveAttribute('data-r', '3');
  await expect(page.locator('.touch-drag-ghost')).toHaveCount(0);
  await page.locator('.item-tools summary').click();
  await page.getByLabel('장비 도구 대상').selectOption(`unit:${firstId}`);
  await page.getByRole('button', { name: '장비 회수 · 1개 사용' }).click();
  await expect(page.locator('.item-tools summary')).toContainText('제거기 1');
  await expect(page.locator('[data-touch-item]')).toHaveCount(3);
  await page.getByLabel('사용할 장비 도구').selectOption('REFORGER');
  await page.getByLabel('장비 도구 대상').selectOption('item:tool-component');
  const oldName = await page.locator('[data-touch-item="tool-component"]').getAttribute('aria-label');
  await page.getByRole('button', { name: '장비 재조합 · 1개 사용' }).click();
  await expect(page.locator('.item-tools summary')).toContainText('재조합기 1');
  await expect(page.locator('[data-touch-item="tool-component"]')).not.toHaveAttribute('aria-label', oldName!);
});

test('scouting replaces the main arena and follows opponent combat without rewinding the match', async ({ page }) => {
  await preparedGame(page, 'patch-tools');
  await page.locator('.leader-row:not(.self)').first().click();
  const watched = await page.locator('.prep-layer').getAttribute('data-viewed-player');
  expect(watched).not.toBe('p1');
  await expect(page.locator('.prep-layer')).toHaveAttribute('data-prep-board', 'readonly');
  await expect(page.locator('.scout-board')).toHaveCount(0);
  await page.getByRole('button', { name: /전투 시작 \(/ }).click();
  await expect(page.locator('.scouting-banner')).toContainText('전투 관전');
  await expect(page.locator(`[data-combat-id^="${watched}#"]`).first()).toBeVisible();
  const before = Number((await page.locator('.battle-clock strong').innerText()).replace('초', ''));
  await page.getByRole('button', { name: '내 필드로 돌아가기', exact: true }).click();
  await expect(page.locator('[data-combat-id^="p1#"]').first()).toBeVisible();
  expect(Number((await page.locator('.battle-clock strong').innerText()).replace('초', ''))).toBeGreaterThanOrEqual(before);
});

for (const source of ['unit', 'item']) test(`battle transition cancels an active ${source} drag before its drop`, async ({ page }) => {
  await preparedGame(page, 'patch-tools');
  const locator = page.locator(source === 'unit' ? '.bench-slot.filled' : '[data-touch-item]').first();
  const a = (await locator.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 25, a.y + a.height / 2 - 20, { steps: 5 });
  await expect(page.locator('.touch-drag-ghost')).toHaveCount(1);
  // Same start action used when the preparation timer expires, while held down.
  await page.getByRole('button', { name: /전투 시작 \(/ }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('.battle-layer')).toBeVisible();
  await expect(page.locator('.touch-drag-ghost')).toHaveCount(0);
  await expect(page.locator('.sell-overlay')).toHaveCount(0);
  const sell = (await page.locator('[data-drop="sell"]').boundingBox())!;
  await page.mouse.move(sell.x + 30, sell.y + 30); await page.mouse.up();
  await expect(page.locator('.touch-drag-ghost')).toHaveCount(0);
  await expect(page.locator('[data-touch-item="tool-component"]')).toHaveCount(1);
});
