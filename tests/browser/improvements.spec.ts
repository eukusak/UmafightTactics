/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('viewport fit, resolution options and persisted music controls', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?dev=1'); await page.getByRole('button', {name:'시작하기'}).click();
  await page.getByRole('button',{name:/^설정/}).click();
  await expect(page.getByLabel('개발자 패널')).toHaveCount(0);
  for (const value of ['1280x720','1600x900','1920x1080','2560x1440','auto']) {
    await page.getByLabel('해상도',{exact:true}).selectOption(value);
    const box = (await page.locator('.stage').boundingBox())!, view = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1); expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
  }
  await page.getByLabel('음악 음량').press('Home'); await page.getByLabel('음악 음량').press('ArrowRight'); await page.getByLabel('효과음 음량').press('End');
  await page.getByLabel('전체 음소거').click(); await page.reload();
  await page.getByRole('button',{name:'시작하기'}).click();await page.getByRole('button',{name:/^설정/}).click();
  await expect(page.getByLabel('음악 음량')).toHaveValue('1');await expect(page.getByLabel('효과음 음량')).toHaveValue('100');await expect(page.getByLabel('전체 음소거')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:info.outputPath('settings.png')}); expect(errors).toEqual([]);
});

test('augment entrance and choice transition apply only one selection', async ({page},info)=>{
  await preparedGame(page,'augment');
  const overlay=page.locator('.augment-overlay');await expect(overlay).toBeVisible();
  await expect(overlay.locator('.choice-card')).toHaveCount(3);
  await page.screenshot({path:info.outputPath('augment-offer.png')});
  await overlay.locator('.choice-card').first().click();
  await expect(overlay).toHaveClass(/choosing/);await expect(overlay.locator('.chosen')).toHaveCount(1);
  await page.screenshot({path:info.outputPath('augment-selected.png')});await expect(overlay).toHaveCount(0);
});

test('all battle contributors, three metrics and prior round persist until next fight',async({page},info)=>{
  await preparedGame(page,'recap');
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  await page.getByLabel('전투 기여 전체 보기').click();
  await expect(page.locator('.recap-row')).toHaveCount(8);
  await expect(page.locator('.battle-recap')).toContainText('가한 피해량');
  await page.getByLabel('다음 통계').click();await expect(page.locator('.battle-recap')).toContainText('받은 피해량');
  await page.getByLabel('다음 통계').click();await expect(page.locator('.battle-recap')).toContainText('보호막 생성량');
  await page.getByRole('button',{name:'전투 건너뛰기'}).click();
  await page.getByRole('button',{name:/다음 라운드로/}).click();
  await page.getByRole('button',{name:'준비 타이머 일시정지'}).click();
  await expect(page.getByLabel('전투 기여 전체 보기')).toBeVisible();
  await expect(page.locator('.battle-recap')).toContainText('이전 전투');await expect(page.locator('.recap-row')).toHaveCount(8);
  await page.getByLabel('다음 통계').click();
  await expect(page.locator('.battle-recap')).toContainText('가한 피해량');
  await expect.poll(async()=>Number((await page.locator('.recap-row b').first().innerText()).replaceAll(',',''))).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('previous-battle-recap.png')});
  await page.getByRole('button',{name:/전투 시작 \(/}).click();await expect(page.locator('.battle-recap')).toContainText('현재 전투');
});

test('every portrait surface uses delivered portrait assets',async({page},info)=>{
  await page.goto('/');await page.getByRole('button',{name:'시작하기'}).click();await page.getByRole('button',{name:'도감 (145명)'}).click();
  await expect(page.locator('.collection-card img')).toHaveCount(145);
  const images=await page.locator('.collection-card img').evaluateAll(images=>images.map(i=>({src:(i as HTMLImageElement).src,width:(i as HTMLImageElement).naturalWidth})));
  expect(images.every(i=>i.src.includes('/assets/portraits/'))).toBe(true);
  await expect.poll(async()=>page.locator('.collection-card img').evaluateAll(images=>images.every(i=>(i as HTMLImageElement).naturalWidth>0))).toBe(true);
  await expect(page.locator('option', {hasText:'연대 전체'})).toHaveCount(0);await expect(page.locator('option[value="inactive"]')).toHaveCount(0);
  const options=await page.getByLabel('특성',{exact:true}).locator('option').allTextContents();expect(options).toContain('황금세대');expect(options).not.toContain('도주');expect(options).not.toContain('마일러');
  await page.screenshot({path:info.outputPath('portraits-collection.png')});
});
