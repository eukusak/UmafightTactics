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

/**
 * The call-out is on screen for 0.6s of battle time per phase change and then
 * unmounts, so a rect read from a node that has just gone comes back zeroed and
 * every comparison against it would pass vacuously. Read attachment and
 * geometry in one evaluate and poll until a live, laid-out capture arrives.
 */
type CallOut={connected:boolean;top:number;bottom:number;height:number;centre:number;fieldMid:number;boardBottom:number;panelTop:number};
async function phaseCallOut(page:Page):Promise<CallOut>{
  let box:CallOut|null=null;
  // page.evaluate, not locator.evaluate: a locator auto-waits for a missing
  // element and only gives up at the action timeout, so each attempt made
  // between two call-outs would burn ten seconds of this poll's budget and
  // leave it about two tries. querySelector answers in a frame either way.
  await expect.poll(async()=>{
    box=await page.evaluate(():CallOut|null=>{
      const e=document.querySelector('.race-hud-banner');
      if(!e)return null;
      const b=e.getBoundingClientRect(),field=document.querySelector('.field-surface')!.getBoundingClientRect();
      const panel=document.querySelector('.battle-lower-hud .battle-damage-panel')!.getBoundingClientRect();
      const cells=Array.from(document.querySelectorAll('.arena-grid polygon'));
      return {connected:e.isConnected,top:b.top,bottom:b.bottom,height:b.height,centre:b.x+b.width/2,
        fieldMid:field.x+field.width/2,boardBottom:cells.reduce((m,c)=>Math.max(m,c.getBoundingClientRect().bottom),0),panelTop:panel.top};
    });
    return !!box&&box.connected&&box.height>0;
  },{timeout:25000}).toBe(true);
  return box!;
}

test('the phase call-out sits in the strip between the last board row and the damage panel',async({page},testInfo)=>{
  await preparedGame(page,'race-combat');
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  const box=await phaseCallOut(page);
  expect(box.bottom).toBeLessThanOrEqual(box.panelTop);
  expect(box.top).toBeGreaterThanOrEqual(box.boardBottom);
  expect(Math.abs(box.centre-box.fieldMid)).toBeLessThanOrEqual(2);
  await page.screenshot({path:testInfo.outputPath('phase-banner.png')});
});

test.describe(()=>{
  test.use({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  /**
   * A landscape phone scales the field down far enough that the desktop size
   * lands at roughly 24px of screen height, so there the call-out takes most of
   * the strip rather than the share that leaves a monitor comfortable margins.
   */
  test('a landscape phone gives the phase call-out most of that strip',async({page},testInfo)=>{
    await preparedGame(page,'race-combat');
    await page.getByRole('button',{name:/전투 시작 \(/}).click();
    const box=await phaseCallOut(page);
    expect(box.bottom).toBeLessThanOrEqual(box.panelTop);
    expect(box.top).toBeGreaterThanOrEqual(box.boardBottom);
    expect(Math.abs(box.centre-box.fieldMid)).toBeLessThanOrEqual(2);
    expect(box.height).toBeGreaterThan((box.panelTop-box.boardBottom)*.85);
    await page.screenshot({path:testInfo.outputPath('phase-banner-landscape.png')});
  });
});

test('the phase call-out stays up long enough to read, and fades rather than vanishing',async({page})=>{
  await preparedGame(page,'race-combat');
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  /**
   * Measure the WALL-CLOCK span the call-out stays continuously visible, not a
   * count of samples. Counting samples silently encodes the sampling rate into
   * the assertion, so a slow machine fails a correct build.
   *
   * Sampling goes through page.evaluate rather than locator.evaluate for the
   * same reason: a locator auto-waits for a missing element and only gives up
   * at the action timeout, so every sample taken between two call-outs costs
   * ten seconds instead of one frame. querySelector just answers.
   *
   * battleSpeed defaults to 1, so the window is 1.5 real seconds. The 0.6s this
   * replaced cannot reach 1.0s at any speed, so that is the bound.
   */
  const samples:Array<{t:number;up:boolean;opacity:number}>=[];
  const deadline=Date.now()+14000;
  const spans=():number[]=>{
    const out:number[]=[];let from:number|null=null,last=0;
    for(const s of samples){
      const on=s.up&&s.opacity>0;
      if(on){ if(from===null)from=s.t; last=s.t; }
      else if(from!==null){ out.push(last-from); from=null; }
    }
    if(from!==null)out.push(last-from);
    return out;
  };
  const faded=():boolean=>samples.some(s=>s.up&&s.opacity>0.02&&s.opacity<0.98);
  // Stop as soon as one call-out has been seen through to its end.
  while(Date.now()<deadline&&!(Math.max(0,...spans())>=1000&&faded())){
    samples.push({t:Date.now(),...await page.evaluate(()=>{
      const e=document.querySelector('.race-hud-banner');
      return e?{up:true,opacity:Number(getComputedStyle(e).opacity)}:{up:false,opacity:0};
    })});
    await page.waitForTimeout(100);
  }
  const longest=Math.max(0,...spans());
  expect(longest,`spans(ms) ${JSON.stringify(spans())} over ${samples.length} samples`).toBeGreaterThanOrEqual(1000);
  const seen=samples.filter(s=>s.up&&s.opacity>0).map(s=>s.opacity);
  expect(Math.max(...seen)).toBeCloseTo(1,1);
  // The tail ramps down, so at least one sample sits strictly between.
  expect(faded(),`opacities ${JSON.stringify(seen)}`).toBe(true);
});