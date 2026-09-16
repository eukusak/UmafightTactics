import { test, expect } from '@playwright/test';

/**
 * Both surfaces live off the main menu on purpose. The race guide is the
 * reference you read before a match; a player mid-round is served by the
 * prep-phase side panel, which already translates that round's own conditions
 * for their board.
 */
const GUIDE_TABS = ['구간과 각질', '마장', '페이스', '날씨', '개최 특례', 'GⅠ 과제'];

async function mainMenu(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
}

test('the item codex lists all 77 items with their icons and recipes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const notFound: string[] = [];
  page.on('response', r => { if (/\/assets\/items\//.test(r.url()) && r.status() >= 400) notFound.push(r.url()); });

  await mainMenu(page);
  await page.getByRole('button', { name: /도감 \(/ }).click();
  // Units stay the landing tab; the roster count in the menu button promises it.
  await expect(page.locator('.collection-card')).not.toHaveCount(0);

  await page.getByRole('tab', { name: '아이템' }).click();
  await expect(page.locator('.item-row')).toHaveCount(77);

  // A recipe is only useful if its component icons render, so assert on the
  // images rather than on the text beside them.
  const combined = page.locator('.item-row', { has: page.locator('.item-part') });
  await expect(combined).toHaveCount(55);
  const broken = await page.evaluate(() =>
    Array.from(document.images).filter(i => !i.naturalWidth).map(i => i.getAttribute('src')));
  expect(broken, `깨진 아이콘: ${broken.join(', ')}`).toEqual([]);

  for (const [label, count] of [['기본 재료', 10], ['조합', 55], ['특수', 12]] as const) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.item-row')).toHaveCount(count);
  }

  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByLabel('아이템 검색').fill('인자');
  await expect(page.locator('.item-row').first()).toBeVisible();
  expect(await page.locator('.item-row').count()).toBeLessThan(77);

  expect(notFound).toEqual([]);
  expect(errors).toEqual([]);
});

test('the race guide explains every axis from the main menu', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  await mainMenu(page);
  await page.getByRole('button', { name: '레이스 도움말' }).click();
  await expect(page.locator('.guide-screen')).toBeVisible();

  for (const tab of GUIDE_TABS) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
    // Each tab must render content, not an empty panel.
    await expect(page.locator('.guide-body section').first()).toBeVisible();
  }

  // The pace multipliers are the single biggest interaction in the system, so
  // the guide is not doing its job if they are absent.
  await page.getByRole('tab', { name: '페이스', exact: true }).click();
  await expect(page.locator('.guide-body')).toContainText('×0.55');
  await expect(page.locator('.guide-body')).toContainText('×1.45');

  await page.getByRole('tab', { name: '구간과 각질', exact: true }).click();
  await expect(page.locator('.guide-body')).toContainText('최종 직선');
  await page.screenshot({ path: info.outputPath('guide.png'), fullPage: false });

  // Nothing may scroll sideways on a narrow screen.
  await page.setViewportSize({ width: 390, height: 780 });
  await page.getByRole('tab', { name: 'GⅠ 과제', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1);

  expect(errors).toEqual([]);
});

test('the guide is a main-menu reference, not an in-match one', async ({ page }) => {
  await mainMenu(page);
  await page.getByRole('button', { name: '레이스 도움말' }).click();
  await expect(page.locator('.guide-screen')).toBeVisible();
  await page.getByRole('button', { name: '메인 메뉴' }).click();
  await expect(page.locator('.menu-screen')).toBeVisible();
  await expect(page.locator('.guide-screen')).toHaveCount(0);
});
