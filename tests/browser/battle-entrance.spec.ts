import { test, expect, type Page } from '@playwright/test';
import { preparedGame } from './fixtures';

/** The HUD clock prints battle seconds directly, so it is the clock itself. */
const clock = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('.race-clock');
  return el ? parseFloat(el.textContent ?? '') : -1;
});

test('the battle waits for the arena instead of starting behind it', async ({ page }) => {
  await preparedGame(page, 'race-combat');

  /**
   * The regression this guards: the clock used to advance from the moment the
   * battle started, while Phaser was still downloading the sheets needed to
   * draw it — measured at 21.5s on a 4Mbps line against an ~18s battle, so the
   * recording could be over before it was visible. Throttling makes the window
   * wide enough to sample; the assertion is that no battle time is spent
   * before the arena can show it.
   */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 100, downloadThroughput: 700 * 1024 / 8, uploadThroughput: 700 * 1024 / 8,
  });

  await page.getByRole('button', { name: /전투 시작 \(/ }).click();

  // While loading, the cover stands in for the arena and no clock exists yet.
  await expect(page.locator('.battle-loading')).toBeVisible();
  expect(await clock(page)).toBe(-1);

  await page.locator('.race-hud-slot').waitFor({ state: 'attached', timeout: 240000 });
  await expect(page.locator('.battle-loading')).toHaveCount(0);

  // The first reading once the arena exists must be the start of the battle,
  // not wherever an unattended clock had wandered to.
  expect(await clock(page)).toBeLessThanOrEqual(0.5);
});

test('both sides walk on before the clock starts, and it then runs', async ({ page }) => {
  await preparedGame(page, 'race-combat');
  await page.getByRole('button', { name: /전투 시작 \(/ }).click();
  await page.locator('.race-hud-slot').waitFor({ state: 'attached', timeout: 60000 });

  // Sample across the entrance: it holds at zero, then time moves.
  const samples: number[] = [];
  for (let i = 0; i < 40 && (samples.at(-1) ?? 0) < 1; i++) {
    samples.push(await clock(page));
    await page.waitForTimeout(50);
  }
  expect(samples[0]).toBeLessThanOrEqual(0.5);
  expect(samples.at(-1)!).toBeGreaterThan(samples[0]);
  // Monotonic: the entrance must not rewind the clock it is holding.
  for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
});
