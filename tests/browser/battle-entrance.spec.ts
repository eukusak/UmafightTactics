import { test, expect, type Page } from '@playwright/test';
import { preparedGame } from './fixtures';

/** The HUD clock prints battle seconds directly, so it is the clock itself. */
const clock = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('.race-clock');
  return el ? parseFloat(el.textContent ?? '') : -1;
});

test('the battle waits for the arena instead of starting behind it', async ({ page }) => {
  // Deliberately slow: it has to load an arena over a throttled line to have
  // anything to measure. The default per-test budget is 60s, and a CI runner
  // is slower than a laptop, so it declares its own rather than dying with a
  // bare timeout that says nothing about the behaviour under test.
  test.slow();
  await preparedGame(page, 'race-combat');

  /**
   * The regression this guards: the clock used to advance from the moment the
   * battle started, while Phaser was still downloading the sheets needed to
   * draw it. Sampled during a load with the gate removed, battleTime reached
   * 7.45s of an 18.05s recording before anything was on screen.
   *
   * Throttling only widens that window so it can be sampled reliably on any
   * machine. 4Mbps puts the load around ten seconds here — long enough that an
   * ungated clock is unmistakably past the bound, short enough to stay well
   * inside the budget. The earlier 700kbps left the test itself timing out,
   * which proves nothing about the product.
   */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 80, downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 4 * 1024 * 1024 / 8,
  });

  await page.getByRole('button', { name: /전투 시작 \(/ }).click();

  // While loading, the cover stands in for the arena and no clock exists yet.
  await expect(page.locator('.battle-loading')).toBeVisible();
  expect(await clock(page)).toBe(-1);

  await page.locator('.race-hud-slot').waitFor({ state: 'attached', timeout: 90000 });
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
