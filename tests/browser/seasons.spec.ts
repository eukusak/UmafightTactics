import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { SeasonDef } from '../../src/game/engine/seasons/catalog';

const { seasons: SEASONS } = JSON.parse(readFileSync(new URL('../../src/data/generated/seasons.json', import.meta.url), 'utf8')) as { seasons: SeasonDef[] };

async function mainMenu(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
}

async function inViewport(page: Page, selector: string): Promise<void> {
  const bounds = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
}

for (const season of SEASONS) {
  test(`${season.id}: artwork, roster and solo game`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/assets/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await mainMenu(page);
    await page.getByRole('button', { name: '새 게임' }).click();
    const card = page.getByRole('button', { name: new RegExp(season.name) });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.season-card[aria-pressed="true"]')).toHaveCount(1);
    for (const image of await page.locator('.season-card-art').all()) {
      await expect(image).toHaveJSProperty('complete', true);
      await expect(image).toHaveJSProperty('naturalWidth', 1672);
    }
    await expect(page.locator('.season-screen')).toHaveCSS('background-image', new RegExp(`/seasons/${season.id}\\.webp`));
    await expect(page.locator('.season-detail-heading > strong')).toHaveText(`${season.name} · 전용 시너지`);
    await expect(page.locator('.season-traits > div')).toHaveCount(4);
    await expect(page.locator('.season-traits em')).toHaveText(Array.from({ length: 4 }, () => ['3', '5', '7', '10']).flat());
    await inViewport(page, '.season-picker');
    await inViewport(page, '.season-screen .menu-buttons');
    await page.screenshot({ path: info.outputPath(`${season.id}-setup.png`) });

    await page.getByRole('button', { name: '출전 기물 60명 보기' }).click();
    await expect(page.locator('.season-roster-units > div')).toHaveCount(60);
    for (const group of await page.locator('.season-roster-units').all()) await expect(group.locator(':scope > div')).toHaveCount(15);
    for (const image of await page.locator('.season-roster-units img').all()) {
      await expect(image).toHaveJSProperty('complete', true);
      await expect(image).toHaveJSProperty('naturalWidth', 256);
    }
    await page.screenshot({ path: info.outputPath(`${season.id}-roster.png`) });
    await page.getByRole('button', { name: '닫기' }).click();
    await expect(page.locator('.season-roster')).toHaveCount(0);
    await page.getByRole('button', { name: '게임 시작' }).click();
    await expect(page.locator('.hud-top')).toContainText(season.id.toUpperCase());
    await expect(page.locator('.hud-shop')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('collection trait filters without season or era selectors', async ({ page }, info) => {
  await mainMenu(page);
  await page.getByRole('button', { name: '도감 (145명)' }).click();
  await expect(page.locator('.collection-card')).toHaveCount(145);
  for (const season of SEASONS) {
    await expect(page.getByLabel('도감 시즌')).toHaveCount(0);
    for (const trait of season.traits) {
      await page.getByLabel('특성', { exact: true }).selectOption(trait.id);
      await expect(page.locator('.collection-card')).toHaveCount(15);
    }
  }
  await page.screenshot({ path: info.outputPath('collection.png') });
});

test('online season selection, room creation and joining', async ({ page, browser }, info) => {
  const guest = await browser.newPage({ baseURL: 'http://127.0.0.1:4173', viewport: page.viewportSize()! });
  try {
    await mainMenu(page);
    await page.getByRole('button', { name: '온라인 대전 · 최대 8인' }).click();
    for (const season of SEASONS) {
      await page.getByLabel('새 방 시즌').selectOption(season.id);
      await expect(page.locator('.season-screen')).toHaveCSS('background-image', new RegExp(`/seasons/${season.id}\\.webp`));
      await page.getByRole('button', { name: '새 방 만들기' }).click();
      await expect(page.locator('.online-lobby')).toContainText(`${season.id.toUpperCase()} · ${season.name}`);
      await expect(page.locator('.online-seat.occupied')).toHaveCount(1);
      const code = await page.locator('.room-code strong').innerText();
      await mainMenu(guest);
      await guest.getByRole('button', { name: '온라인 대전 · 최대 8인' }).click();
      await guest.getByLabel('방 코드', { exact: true }).fill(code);
      await guest.getByRole('button', { name: '방 참가' }).click();
      await expect(guest.locator('.online-lobby')).toContainText(season.name);
      await expect(guest.locator('.season-screen')).toHaveCSS('background-image', new RegExp(`/seasons/${season.id}\\.webp`));
      await expect(page.locator('.online-seat.occupied')).toHaveCount(2);
      await page.screenshot({ path: info.outputPath(`${season.id}-online.png`) });
      await guest.getByRole('button', { name: '방 나가기' }).click();
      await page.getByRole('button', { name: '방 나가기' }).click();
      await expect(page.getByLabel('새 방 시즌')).toBeVisible();
    }
  } finally { await guest.close(); }
});
