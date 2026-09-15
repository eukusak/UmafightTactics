import {test,expect} from '@playwright/test';

test('PR27 newcomers load all motion clips, portraits and the delivered legendary cut-in',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const failures:string[]=[];page.on('response',r=>{if(r.status()>=400&&/deep_impact|soccer_boy|kurofune/.test(r.url()))failures.push(r.url());});
 await page.goto('/');await page.getByRole('button',{name:'시작하기'}).click();await page.getByRole('button',{name:/모션/}).click();
 for(const id of ['soccer_boy','kurofune','deep_impact']){
  await page.getByLabel('기물 선택').selectOption(id);
  await expect(page.getByText('프레임 애니메이션 · 6종 모션 · 24개 원화',{exact:true})).toBeVisible();
  const sizes=await page.evaluate(async id=>{const out=[];for(const type of ['motions','portraits']){const im=new Image();im.src='/assets/'+type+'/'+id+'.png';await im.decode();out.push([im.naturalWidth,im.naturalHeight]);}return out;},id);
  expect(sizes).toEqual([[512,768],[256,256]]);
  for(const label of ['대기','달리기','공격','스킬','쓰러짐','승리']){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('.motion-preview canvas')).toBeVisible();}
  await page.getByRole('button',{name:'스킬',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:info.outputPath(id+'-skill.png')});
  await page.getByRole('button',{name:'방향 반전'}).click();
 }
 const details=page.locator('.legendary-cutin-preview');await details.locator('summary').click();const image=details.locator('img');await expect(image).toBeVisible();await expect.poll(()=>image.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth===960&&i.naturalHeight===540)).toBe(true);
 await page.screenshot({path:info.outputPath('deep-impact-cutin.png')});expect(errors).toEqual([]);expect(failures).toEqual([]);
});
