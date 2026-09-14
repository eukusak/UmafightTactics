
import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';
test('race art loads, markers do not intercept placement, and weather uses the small atlas', async ({ page }, info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const assets:string[]=[];page.on('request',r=>{if(r.url().includes('/assets/race/'))assets.push(r.url());});
  await preparedGame(page,'race-combat');
  const strip=page.locator('.race-conditions-strip').first();
  await expect(strip).toBeVisible();
  await expect(strip.locator('img')).toHaveCount(3);
  const loaded=await strip.locator('img').evaluateAll(async images=>Promise.all(images.map(async node=>{const im=node as HTMLImageElement;await im.decode();return im.naturalWidth>0;})));
  expect(loaded.every(Boolean)).toBe(true);
  for(const marker of await page.locator('.race-exposed').all()) expect(await marker.evaluate(e=>getComputedStyle(e).pointerEvents)).toBe('none');
  await page.screenshot({path:info.outputPath('race-art-prep.png')});
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  await expect(page.locator('.race-hud')).toBeVisible();
  await expect(page.locator('.race-exposed')).toHaveCount(0);
  await expect(page.locator('.race-weather .race-sprite')).toBeVisible();
  expect(await page.locator('.race-weather .race-sprite').evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('@half.png');
  await page.waitForTimeout(1200);
  await page.screenshot({path:info.outputPath('race-art-combat.png')});
  expect(assets.some(u=>/weather_.*@half\.png/.test(u))).toBe(true);
  expect(assets.some(u=>/\/weather_(clear|cloudy|rain|snow|gale)\.png/.test(u))).toBe(false);
  expect(errors).toEqual([]);
});
test('generated decorations fail gracefully without blocking the game',async({page})=>{
  await page.route('**/assets/race/**',r=>r.abort());
  await preparedGame(page,'race-combat');
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  await expect(page.locator('.race-hud')).toBeVisible();
  await expect(page.locator('.race-clock')).toContainText('%');
});
test('reduced-motion preparation marker is visible, static and ignores pointer input',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await preparedGame(page,'art-exposed');
  const marker=page.locator('.race-exposed-sheet').first();
  await expect(marker).toBeVisible();
  expect(await marker.evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  expect(await marker.evaluate(e=>getComputedStyle(e).pointerEvents)).toBe('none');
  await page.screenshot({path:info.outputPath('exposed-marker.png')});
});
