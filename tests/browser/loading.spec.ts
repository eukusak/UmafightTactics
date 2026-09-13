import { test, expect } from '@playwright/test';

test('cold title and collection defer Phaser and do not preload all motion or music files', async ({ page }, info) => {
  const requests: string[] = []; const errors: string[] = [];
  page.on('request', request => requests.push(request.url())); page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();
  expect(requests.some(url => /phaser-.*\.js/.test(url))).toBe(false);
  expect(requests.some(url => url.includes('/motions/'))).toBe(false);
  expect(requests.filter(url => /\.mp3/.test(url)).length).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /도감 \(145명\)/ }).click();
  await expect(page.locator('.collection-card')).toHaveCount(145);
  expect(requests.some(url => /phaser-.*\.js/.test(url))).toBe(false);
  await expect(page.locator('.collection-card img').first()).toHaveAttribute('loading', 'lazy');
  await page.getByPlaceholder('이름 검색').fill('스페셜');
  await expect(page.locator('.collection-card')).toHaveCount(1);
  expect(errors).toEqual([]);
  await info.attach('cold-load-resources', { body: JSON.stringify(requests, null, 2), contentType: 'application/json' });
});


test('repeated motion previews release document and window listeners and canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  const listeners = async (): Promise<number> => {
    let count = 0;
    for (const expression of ['document', 'window']) {
      const { result } = await cdp.send('Runtime.evaluate', { expression, objectGroup: 'listener-audit' });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
      count += listeners.filter(l => ['visibilitychange', 'blur', 'focus'].includes(l.type)).length;
    }
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'listener-audit' });
    return count;
  };
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  const baseline = await listeners();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: /모션/ }).click();
    await expect(page.getByText('프레임 애니메이션 · 6종 모션 · 24개 원화', { exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    expect(await listeners()).toBeGreaterThan(baseline);
    await page.getByRole('button', { name: '돌아가기' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(listeners).toBe(baseline);
  }
  expect(errors).toEqual([]);
});
