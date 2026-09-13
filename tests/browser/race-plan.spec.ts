import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { preparedGame } from './fixtures';
import type { Page } from '@playwright/test';
async function open(page:Page,mode:string){
  const save=execFileSync(process.execPath,['--import','tsx','tests/support/browser-save.ts',mode],{encoding:'utf8'}).trim();
  await page.goto('/');
  await page.evaluate(s=>localStorage.setItem('uma-fight-tactics-save-v1',s),save);
  await page.reload();await page.getByRole('button',{name:'시작하기'}).click();await page.getByRole('button',{name:'이어하기'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
for(const mode of ['race-plan','race-evolution','race-entry','race-finishing']){
  test(mode+' displays generated art and readable controls',async({page},testInfo)=>{
    await open(page,mode);
    const dialog=page.getByRole('dialog');await expect(dialog.locator('button').first()).toBeVisible();
    const image=await dialog.locator('.race-header').evaluate(e=>getComputedStyle(e).backgroundImage);
    expect(image).toContain(mode==='race-entry'?'bg_g1_entry_board':'bg_paddock_panel');
    await dialog.evaluate(async e=>{
      const urls=getComputedStyle(e.querySelector('.race-header')!).backgroundImage.match(/url\("?([^")]+)"?\)/g)??[];
      for(const url of urls){const img=new Image();img.src=url.replace(/^url\("?|"?\)$/g,'');await img.decode();}
    });
    await page.screenshot({path:testInfo.outputPath(mode+'.png')});
    await page.keyboard.press('Tab');expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);
    if(mode==='race-plan'){
      const reroll=dialog.getByRole('button',{name:'A 작전 새로고침'});
      await reroll.click();await expect(reroll).toBeDisabled();
      await page.reload();await page.getByRole('button',{name:'시작하기'}).click();await page.getByRole('button',{name:'이어하기'}).click();
      await expect(reroll).toBeDisabled();
      await dialog.getByRole('button',{name:'이 작전으로 출주'}).first().click();
      await expect(dialog).toHaveCount(0);
    }
    if(mode==='race-entry'){
      await dialog.getByRole('button',{name:'출주 등록',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'최종 승부수'})).toBeVisible();
    }
  });
}
for(const width of [360,390,412]){
 test('race plan fits '+width+'px and traps keyboard focus',async({page},testInfo)=>{
   await page.setViewportSize({width,height:800});await page.emulateMedia({reducedMotion:'reduce'});
   await open(page,'race-plan');
   const dialog=page.getByRole('dialog');
   expect(await dialog.locator('.race-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
   const last=dialog.locator('button').last();await last.focus();await page.keyboard.press('Tab');
   await expect(dialog.locator('button').first()).toBeFocused();
   await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
   await page.screenshot({path:testInfo.outputPath('mobile-'+width+'.png')});
 });
}

test('missing race art keeps choices usable',async({page})=>{
  await page.route('**/assets/boards/bg_*',r=>r.abort());
  await open(page,'race-plan');
  await page.getByRole('button',{name:'이 작전으로 출주'}).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('local race deadline auto-selects instead of leaving a stuck modal',async({page})=>{
  await open(page,'race-plan');await page.clock.install();
  await page.clock.fastForward(46_000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('recorded race battle loads all frame sheets and presents progress without errors',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await preparedGame(page,'race-combat');
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  await expect(page.locator('.race-hud')).toBeVisible();
  await expect(page.locator('.race-clock')).toContainText('%');
  const hud=await page.locator('.race-hud').boundingBox(),opponent=await page.locator('.battle-matchup').boundingBox();
  expect(hud!.y).toBeGreaterThanOrEqual(opponent!.y+opponent!.height);
  const sizes=await page.evaluate(async()=>Promise.all(['vfx_race_gate','vfx_race_late_ring','vfx_race_last3f'].map(async key=>{const im=new Image();im.src='/assets/vfx/'+key+'.png';await im.decode();return [im.naturalWidth,im.naturalHeight];})));
  expect(sizes).toEqual([[1920,192],[1920,192],[1920,192]]);
  await page.waitForTimeout(3500);
  await page.screenshot({path:testInfo.outputPath('race-combat.png')});
  expect(errors).toEqual([]);
});
