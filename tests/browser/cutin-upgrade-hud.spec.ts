import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('legendary cinematic appears above the lower-left damage panel without intercepting clicks', async ({page},info) => {
  await preparedGame(page,'cutin-hud');
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  const cutin=page.locator('.battle-legendary-cutin');
  await expect(cutin).toBeVisible({timeout:20000});
  /**
   * The cut-in is on screen for 0.85s of battle time and React then unmounts
   * it. Decoding the image and measuring it therefore have to happen inside one
   * window, and they have to happen together: a detached node reports a zeroed
   * rect and an empty computed style, so measuring one that has just gone makes
   * every comparison below pass against zeros without checking anything. The
   * poll keeps trying — cut-ins repeat at least five seconds apart — until one
   * capture comes back from an element that is still attached and laid out.
   */
  type Geometry = {connected:boolean;decoded:boolean;bottom:number;panelTop:number;left:number;panelLeft:number;right:number;fieldMid:number;pointer:string};
  let geometry!: Geometry;
  await expect.poll(async()=>{
    geometry=await cutin.evaluate((e:HTMLImageElement):Geometry=>{
      const box=e.getBoundingClientRect(), panel=document.querySelector('.battle-lower-hud .battle-damage-panel')!.getBoundingClientRect(), field=document.querySelector('.field-surface')!.getBoundingClientRect();
      return {connected:e.isConnected,decoded:e.complete && e.naturalWidth>0,bottom:box.bottom,panelTop:panel.top,left:box.left,panelLeft:panel.left,right:box.right,fieldMid:field.x+field.width/2,pointer:getComputedStyle(e).pointerEvents};
    });
    return geometry.connected && geometry.decoded && geometry.bottom>0 && geometry.right>geometry.left;
  },{timeout:20000}).toBe(true);
  expect(geometry.bottom).toBeLessThan(geometry.panelTop-2);
  expect(geometry.left).toBeLessThanOrEqual(geometry.panelLeft+2);
  expect(geometry.right).toBeLessThan(geometry.fieldMid);
  expect(geometry.pointer).toBe('none');
  await page.screenshot({path:info.outputPath('cutin-lower-left.png')});
  await page.getByLabel('전투 기여 전체 보기').click();
  await expect(page.locator('.battle-recap')).toBeVisible();
});

test('shop marks immediate two-star and chained three-star purchases, then removes stale hints', async ({page},info) => {
  await preparedGame(page,'shop-upgrades');
  const cards=page.locator('.shop-card');
  await expect(cards.nth(0).getByLabel('구입 시 2성 합성')).toBeVisible();
  await expect(cards.nth(1).getByLabel('구입 시 3성 합성')).toBeVisible();
  const two=await cards.nth(0).getAttribute('data-unit-def'),three=await cards.nth(1).getAttribute('data-unit-def');
  const twoName=await cards.nth(0).locator('.name').innerText(),threeName=await cards.nth(1).locator('.name').innerText();
  const stars = (name: string) => page.locator('.arena-unit,.bench-slot').filter({has:page.getByRole('img',{name,exact:true})}).locator('.arena-unit-stars,.stars');
  await page.screenshot({path:info.outputPath('shop-upgrade-hints.png')});
  await cards.nth(0).click();
  await expect(page.locator(`.shop-card[data-unit-def="${two}"] .shop-upgrade-badge`)).toHaveCount(0);
  await expect(stars(twoName)).toHaveText('★★');
  await cards.nth(1).click();
  await expect(page.locator(`.shop-card[data-unit-def="${three}"] .shop-upgrade-badge`)).toHaveCount(0);
  await expect(stars(threeName)).toHaveText('★★★');
});

test('upgrade hints remain inside the shop cards on a phone', async ({page},info) => {
  await page.setViewportSize({width:390,height:844});
  await preparedGame(page,'shop-upgrades');
  for(const hint of await page.locator('.shop-upgrade-badge').all()) {
    const fits=await hint.evaluate(e=>{const a=e.getBoundingClientRect(), b=e.closest('.shop-card')!.getBoundingClientRect();return a.left>=b.left && a.right<=b.right && a.top>=b.top && a.bottom<=b.bottom;});
    expect(fits).toBe(true);
  }
  await page.screenshot({path:info.outputPath('phone-upgrade-hints.png')});
});
