import { test, expect } from '@playwright/test';

test('cold title and collection defer Phaser and do not preload all motion or music files', async ({ page }, info) => {
  const requests: string[] = []; const errors: string[] = [];
  page.on('request', request => requests.push(request.url())); page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();
  expect(requests.some(url => /phaser-.*\.js/.test(url))).toBe(false);
  expect(requests.some(url => url.includes('/motions/'))).toBe(false);
  expect(requests.filter(url => /\.mp3/.test(url)).length).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '도감 (145명)', exact: true }).click();
  await expect(page.locator('.collection-card')).toHaveCount(145);
  expect(requests.some(url => /phaser-.*\.js/.test(url))).toBe(false);
  await expect(page.locator('.collection-card img').first()).toHaveAttribute('loading', 'lazy');
  await page.getByPlaceholder('이름 검색').fill('스페셜');
  await expect(page.locator('.collection-card')).toHaveCount(1);
  expect(errors).toEqual([]);
  await info.attach('cold-load-resources', { body: JSON.stringify(requests, null, 2), contentType: 'application/json' });
});
