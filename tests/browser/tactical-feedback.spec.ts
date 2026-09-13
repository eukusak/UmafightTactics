import { test,expect } from '@playwright/test';
import { preparedGame } from './fixtures';
test('each augment has one independent reroll, preserved through reload',async({page},info)=>{
 await preparedGame(page,'augment');
 const names=await page.locator('.augment-slot h4').allTextContents();
 const first=page.getByRole('button',{name:'1번 증강 새로고침'});
 await first.click();await expect(first).toBeDisabled();
 await expect(page.locator('.augment-slot h4').first()).not.toHaveText(names[0]);
 expect((await page.locator('.augment-slot h4').allTextContents()).slice(1)).toEqual(names.slice(1));
 for(const n of [2,3]){const button=page.getByRole('button',{name:n+'번 증강 새로고침'});await expect(button).toBeEnabled();await button.click();await expect(button).toBeDisabled();}
 const rolled=await page.locator('.augment-slot h4').allTextContents();expect(new Set([...names,...rolled]).size).toBe(6);
 await page.reload();await page.getByRole('button',{name:'시작하기'}).click();await page.getByRole('button',{name:'이어하기'}).click();
 expect(await page.locator('.augment-slot h4').allTextContents()).toEqual(rolled);
 await expect(page.locator('.augment-reroll:disabled')).toHaveCount(3);
 await page.screenshot({path:info.outputPath('augment-rerolls.png')});
 await page.locator('.augment-slot .choice-card').first().click();
 await expect(page.locator('.augment-overlay')).toHaveCount(0);
});
test('trait roster is sorted by cost, wishlist toggles and selected members glow',async({page},info)=>{
 await preparedGame(page,'trait-chase');
 await page.locator('.trait-row').filter({hasText:'스프린터'}).click();
 const roster=page.locator('.detail-trait-roster');
 const costs=await roster.locator('b').allTextContents();const values=costs.map(c=>parseInt(c));
 expect(values).toEqual([...values].sort((a,b)=>a-b));
 const star=roster.locator('.trait-wishlist').first();await star.scrollIntoViewIfNeeded();await star.click();await expect(star).toHaveAttribute('aria-pressed','true');await star.click();await expect(star).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.formation-marker')).toHaveCount(9);
 const tier=page.locator('.trait-row').filter({hasText:'스프린터'});await expect(tier).toHaveAttribute('data-prismatic','true');
 await page.screenshot({path:info.outputPath('trait-wishlist-highlight.png')});
 const field=page.locator('.arena-unit .arena-unit-touch').last();
 const id=await field.locator('..').getAttribute('data-unit-id');
 await field.hover();await page.keyboard.press('w');
 const bench=page.locator('.bench-slot[data-unit-id="'+id+'"]');
 await bench.hover();await page.keyboard.press('w');
 await expect(page.locator('.trait-activation')).toContainText('스프린터 4단계 활성화');
 await expect(page.locator('.formation-marker.activated')).toHaveCount(9);
 await page.getByRole('button',{name:'AI 1 편성 확인',exact:true}).click();
 await expect(page.locator('.formation-marker')).toHaveCount(0);
});
test('two and three star combines burst around the actual surviving unit',async({page},info)=>{
 await preparedGame(page,'shop-upgrades');
 for(const [slot,star] of [[0,2],[1,3]]){
  await page.locator('.shop-card').nth(slot).click();
  await expect(page.locator('.promotion-local.star-'+star)).toBeVisible();
  expect(await page.locator('.promotion-local.star-'+star).evaluate(e=>!!e.closest('.arena-unit-touch,.bench-slot'))).toBe(true);
 }
 await page.screenshot({path:info.outputPath('local-three-star-promotion.png')});
});

test('battle playback releases attack, impact and skill audio; mute stops new voices',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const original=AudioContext.prototype.createOscillator;
  (window as unknown as {audioVoices:number}).audioVoices=0;
  AudioContext.prototype.createOscillator=function(){
   const node=original.call(this),start=node.start.bind(node);
   node.start=(when?:number)=>{(window as unknown as {audioVoices:number}).audioVoices++;start(when);};
   return node;
  };
 });
 await preparedGame(page,'cutin-hud');
 await page.getByRole('button',{name:/전투 시작 \(/}).click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioVoices:number}).audioVoices)).toBeGreaterThan(8);
 await page.screenshot({path:info.outputPath('battle-impact-feedback.png')});
 await page.getByRole('button',{name:'전체 음소거',exact:true}).click();
 const before=await page.evaluate(()=>(window as unknown as {audioVoices:number}).audioVoices);
 await page.waitForTimeout(800);
 expect(await page.evaluate(()=>(window as unknown as {audioVoices:number}).audioVoices)).toBe(before);
 expect(errors).toEqual([]);
});
