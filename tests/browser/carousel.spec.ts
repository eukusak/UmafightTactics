/// <reference lib="dom" />
import { test, expect } from '@playwright/test';

test('carousel requires walking, supports arrows and floor clicks, then shows animated idle units and uploaded sounds', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/assets/') && r.status() >= 400) errors.push(r.url()); });
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, '__soundCalls', { value: calls });
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { calls.push(this.currentSrc || this.src); return original.call(this); };
  });
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByLabel('무작위 시드 사용').uncheck();
  await page.getByRole('button', { name: '게임 시작' }).click();
  const arena = page.locator('.carousel-arena'), me = page.locator('.carousel-trainer.mine');
  await expect(me.locator('.animated-unit')).toBeVisible();
  await expect(page.locator('.carousel-option')).toHaveCount(9);
  await expect(page.locator('.carousel-trainer')).toHaveCount(8);
  await expect(me).toHaveAttribute('data-picked', '');
  const bounds = await page.locator('.carousel-panel').boundingBox(), viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
  const initial = await page.locator('.carousel-option').first().getAttribute('style');
  await expect.poll(() => page.locator('.carousel-option').first().getAttribute('style')).not.toBe(initial);
  await expect(me).not.toHaveClass(/waiting/, { timeout: 5000 });
  const x = Number(await me.getAttribute('data-x'));
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => Number(await me.getAttribute('data-x'))).toBeGreaterThan(x + 15);
  await page.keyboard.up('ArrowRight');
  const y = Number(await me.getAttribute('data-y'));
  const rect = (await arena.boundingBox())!;
  // A floor destination near the outer edge tests right-click without accidentally claiming.
  await page.mouse.click(rect.x + rect.width * .93, rect.y + rect.height * .89, { button: 'right' });
  await expect.poll(async () => Number(await me.getAttribute('data-y'))).not.toBe(y);
  await expect(me).toHaveAttribute('data-picked', '');
  await page.screenshot({ path: info.outputPath('carousel-race.png') });
  const option = page.locator('.carousel-option').first();
  const ob = (await option.boundingBox())!;
  await page.mouse.click(ob.x + ob.width / 2, ob.y + ob.height * .7);
  // Clicking issues a chase, with no immediate grant from a distant character.
  await expect(me).toHaveAttribute('data-picked', '');
  await expect(page.locator('.draft-overlay')).toHaveCount(0, { timeout: 35000 });
  await page.getByRole('button', { name: '준비 타이머 일시정지' }).click();
  await page.getByRole('button', { name: '+50G', exact: true }).click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByLabel('개발자 패널').uncheck();
  await page.getByRole('button', { name: '돌아가기' }).click();
  await page.locator('.bench-slot.filled').first().hover(); await page.keyboard.press('w');
  const idle = page.locator('.arena-unit .animated-unit').first();
  await expect(idle).toHaveAttribute('data-animation', 'idle');
  await expect(idle).toHaveCSS('background-image', /assets\/motions\//);
  const frame = await idle.evaluate(e => getComputedStyle(e).backgroundPositionX);
  await expect.poll(() => idle.evaluate(e => getComputedStyle(e).backgroundPositionX)).not.toBe(frame);
  await expect(page.locator('.arena-unit .arena-unit-portrait, .arena-unit .arena-standee')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('field-idle.png') });
  const sounds = () => page.evaluate(() => (window as unknown as { __soundCalls: string[] }).__soundCalls);
  expect((await sounds()).some(s => s.endsWith('/select.mp3'))).toBe(true);
  const before = (await sounds()).filter(s => s.endsWith('/level-up.mp3')).length;
  await page.getByRole('button', { name: /경험치 구매 \(4G\)/ }).click();
  expect((await sounds()).filter(s => s.endsWith('/level-up.mp3'))).toHaveLength(before + 1);
  await page.keyboard.press('f');
  expect((await sounds()).filter(s => s.endsWith('/level-up.mp3'))).toHaveLength(before + 2);
  // Verify both real uploads decode in the browser, beyond recording play calls.
  const decoded = await page.evaluate(async () => {
    const ctx = new AudioContext();
    const durations = await Promise.all(['select', 'level-up'].map(async name => {
      const response = await fetch(`/assets/audio/${name}.mp3`);
      return (await ctx.decodeAudioData(await response.arrayBuffer())).duration;
    }));
    await ctx.close(); return durations;
  });
  expect(decoded.every(duration => duration > .05)).toBe(true);
  expect(errors).toEqual([]);
});
