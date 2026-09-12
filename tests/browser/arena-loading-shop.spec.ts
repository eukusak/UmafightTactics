import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('six shop slots stay on one horizontal row through buying and viewport changes', async ({ page }, info) => {
  await preparedGame(page, 'six-shop');
  const row = page.locator('.shop-row'), cards = row.locator('.shop-card');
  await expect(cards).toHaveCount(6);
  for (const width of [1920, 1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1366 ? 768 : 1080 });
    await expect.poll(async () => {
      const boxes = await cards.evaluateAll(elements => elements.map(e => { const b = e.getBoundingClientRect(); return { top: b.top, left: b.left, right: b.right, width: b.width }; }));
      return boxes.every((b, i) => Math.abs(b.top - boxes[0].top) < 1 && b.width > 40 && (!i || b.left >= boxes[i - 1].right));
    }).toBe(true);
    const bounds = await row.boundingBox(), last = await cards.last().boundingBox();
    expect(last!.x + last!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    await page.screenshot({ path: info.outputPath(`shop-six-${width}.png`) });
  }
  await cards.last().click();
  await expect(cards.last()).toHaveClass(/sold/);
  await expect(cards).toHaveCount(6);
});

test('arena retries a failed image and fills the entire field on desktop and phone', async ({ page }, info) => {
  let attempts = 0;
  await page.route('**/assets/boards/bg_pve_training.png*', async route => {
    attempts++;
    if (attempts === 1) await route.abort('failed'); else await route.continue();
  });
  await preparedGame(page);
  const image = page.locator('.arena-background-image');
  await expect(image).toHaveAttribute('src', /bg_pve_training.png\?v=.+&retry=1/);
  expect(attempts).toBe(2);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    await expect(image).toHaveCSS('object-fit', 'fill');
    await expect.poll(() => image.evaluate(e => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const frame = await page.locator('.hud-field').boundingBox(), picture = await image.boundingBox();
    expect(Math.abs(frame!.width - picture!.width)).toBeLessThan(2);
    expect(Math.abs(frame!.height - picture!.height)).toBeLessThan(2);
    await page.screenshot({ path: info.outputPath(`arena-recovered-${width}.png`) });
  }
});

test('persistent arena failure shows a fallback and can recover with the retry button', async ({ page }) => {
  let offline = true;
  await page.route('**/assets/boards/bg_pve_training.png*', async route => { if (offline) await route.abort('failed'); else await route.continue(); });
  await preparedGame(page);
  await expect(page.locator('.arena-background-image')).toHaveAttribute('src', /bg_board_turf_day.png/);
  const retry = page.getByRole('button', { name: '경기장 이미지 다시 불러오기' });
  await expect(retry).toBeVisible();
  offline = false;
  await retry.click();
  await expect(page.locator('.arena-background-image')).toHaveAttribute('src', /bg_pve_training.png/);
  await expect(retry).toHaveCount(0);
});


test('day arena renders detailed scenery through its previously missing lower rows', async ({ page }, info) => {
  await preparedGame(page, 'arena-day');
  const image = page.locator('.arena-background-image');
  await expect(image).toHaveAttribute('src', /bg_board_turf_day.png/);
  await expect.poll(() => image.evaluate(e => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth === 1920)).toBe(true);
  const bands = await image.evaluate(element => {
    const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 108;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(element as HTMLImageElement, 0, 0, 192, 108);
    return [70, 85, 100, 107].map(y => {
      const pixels = ctx.getImageData(0, y, 192, 1).data;
      const colors = new Set<string>(); let opaque = true;
      for (let x = 0; x < pixels.length; x += 4) {
        colors.add(pixels[x] + ',' + pixels[x + 1] + ',' + pixels[x + 2]);
        opaque &&= pixels[x + 3] === 255;
      }
      return { uniqueColors: colors.size, opaque };
    });
  });
  for (const band of bands) { expect(band.opaque).toBe(true); expect(band.uniqueColors).toBeGreaterThan(40); }
  await page.screenshot({ path: info.outputPath('day-arena-restored.png') });
});
