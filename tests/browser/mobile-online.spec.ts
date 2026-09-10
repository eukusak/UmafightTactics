import { test, expect, type Page, type Locator } from '@playwright/test';
import { preparedGame } from './fixtures';
test.use({ viewport: { width:390, height:844 }, isMobile:true, hasTouch:true });
async function drag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!, b = (await to.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const point = (t:number) => [{x:a.x+a.width/2+(b.x+b.width/2-a.x-a.width/2)*t,y:a.y+a.height/2+(b.y+b.height/2-a.y-a.height/2)*t}];
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(0)});
  for(let i=1;i<=8;i++) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(i/8)});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await session.detach();
}
test('phone touch supports placement, bench return, sales, equipment and responsive rotation', async ({page},info) => {
  await preparedGame(page,'components');
  await page.locator('.shop-card:not(.sold):not(:disabled)').first().tap();
  await expect(page.locator('.bench-slot.filled')).toHaveCount(2);
  const source = page.locator('.bench-slot.filled').first(), id = (await source.getAttribute('data-unit-id'))!;
  const cell = page.locator('.arena-cell[data-q="6"][data-r="3"]');
  await drag(page,source,cell);
  const boardUnit = page.locator('.arena-unit').filter({has:page.locator(`[data-touch-unit="${id}"]`)});
  await expect(boardUnit).toHaveCount(1);
  await drag(page,boardUnit.locator('[data-touch-unit]'),page.locator('.bench-slot').last());
  await expect(boardUnit).toHaveCount(0);
  const before = await page.locator('.bench-slot.filled').count();
  await drag(page,page.locator(`[data-touch-unit="${id}"]`),page.locator('[data-drop="sell"]'));
  await expect(page.locator('.bench-slot.filled')).toHaveCount(before-1);
  await drag(page,page.locator('.bench-slot.filled').first(),cell);
  await expect(page.locator('.arena-unit [data-touch-unit]')).toHaveCount(1);
  // Item inventory is below the board; scrolling during a drag retains the gesture.
  const item = page.locator('[data-touch-item]').first();
  const itemId = await item.getAttribute('data-touch-item');
  const unit = page.locator('.arena-unit [data-touch-unit]').first();
  {
    await item.scrollIntoViewIfNeeded();
    const a=(await item.boundingBox())!;
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+12,y:a.y+a.height/2}]});
    await page.locator('.stage').evaluate(el=>{el.scrollTop=0;});
    const b=(await unit.boundingBox())!;
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await session.detach();
    await expect(page.locator(`[data-touch-item="${itemId}"]`)).toHaveCount(0);
  }
  await page.locator('.stage').evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:info.outputPath('phone.png')});
  for (const viewport of [{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await expect.poll(()=>page.locator('.hud-field').evaluate(el=>Math.round(el.getBoundingClientRect().width))).toBe(viewport.width);
    expect(await page.locator('.stage').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
  await page.screenshot({path:info.outputPath('landscape.png')});
});
test('motion controls are compact and a host can start an online game with seven AI', async ({page},info) => {
  await page.goto('/'); await page.getByRole('button',{name:'시작하기'}).tap();
  await page.getByRole('button',{name:'기물 모션 미리보기'}).tap();
  await expect(page.getByLabel('기물 선택')).toBeVisible();
  await expect(page.getByText(/장면 시간|이전 프레임|다음 프레임|28기 동시|호환 렌더러|스킬 준비|빛의 파동|사거리3의/)).toHaveCount(0);
  await page.screenshot({path:info.outputPath('motion-phone.png')});
  await page.getByRole('button',{name:'돌아가기'}).tap();
  await page.getByRole('button',{name:'온라인 대전 · 최대 8인'}).tap();
  await page.getByRole('button',{name:'새 방 만들기'}).tap();
  await page.getByRole('button',{name:'AI 추가',exact:true}).tap();
  await expect(page.getByText('AI · 준비 완료')).toHaveCount(1);
  await page.getByRole('button',{name:'AI 2 제거'}).tap();
  await expect(page.getByText('AI · 준비 완료')).toHaveCount(0);
  await page.getByRole('button',{name:'준비 완료',exact:true}).tap();
  await page.getByRole('button',{name:'대전 시작'}).tap();
  await expect(page.locator('.carousel-panel')).toBeVisible();
  expect(await page.locator('.carousel-arena').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(390);
  await page.screenshot({path:info.outputPath('online-carousel-phone.png')});
  await expect(page.locator('.carousel-panel')).toHaveCount(0,{timeout:55000});
  await expect(page.getByText('1× · 서버 동기화')).toBeVisible();
  await expect(page.getByRole('button',{name:'전투 건너뛰기'})).toHaveCount(0);
  await page.getByRole('button',{name:'설정',exact:true}).tap();
  await expect(page.getByRole('button',{name:'1×',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:/^(2|4|10)×$/})).toHaveCount(0);
});
