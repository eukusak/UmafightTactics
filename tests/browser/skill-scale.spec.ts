import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('padded art keeps field layout while animating the full texture', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await preparedGame(page, 'frame-scale');
  const bench = page.locator('.bench-slot.filled').first();
  await bench.hover(); await page.keyboard.press('w');
  const art = page.locator('.arena-unit .animated-unit');
  await expect(art).toBeVisible();
  const geometry = await art.evaluate(e => {
    const frame = e.firstElementChild as HTMLElement;
    const box = getComputedStyle(e), pixels = getComputedStyle(frame);
    return { width: parseFloat(box.width), height: parseFloat(box.height), pixels: parseFloat(pixels.width), left: parseFloat(pixels.left), top: parseFloat(pixels.top) };
  });
  expect(geometry.pixels).toBeCloseTo(geometry.width * 2);
  expect(geometry.left).toBeCloseTo(-geometry.width / 2);
  expect(geometry.top).toBeCloseTo(-geometry.height / 2);
  const frames = page.locator('.arena-unit .animated-unit-frames');
  const x = await frames.evaluate(e => getComputedStyle(e).backgroundPositionX);
  await expect.poll(() => frames.evaluate(e => getComputedStyle(e).backgroundPositionX)).not.toBe(x);
  await page.screenshot({ path: info.outputPath('padded-field-art.png') });
  expect(errors).toEqual([]);
});

test('large-effect corrected skills load and play in both preview directions', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /모션/ }).click();
  for (const id of ['almond_eye', 'sweep_tosho', 'victoire_pisa']) {
    await page.getByLabel('기물 선택').selectOption(id);
    await expect(page.getByText('프레임 애니메이션 · 6종 모션 · 24개 원화', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '스킬', exact: true }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: info.outputPath(id + '-normalized.png') });
    await page.getByRole('button', { name: '방향 반전' }).click();
    await page.waitForTimeout(250);
    await expect(page.locator('.motion-preview canvas')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
