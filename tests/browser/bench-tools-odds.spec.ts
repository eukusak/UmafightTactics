import { expect, test } from '@playwright/test';
import { preparedGame } from './fixtures';

test('pointer dragging swaps bench units and live odds change on level-up',async({page},info)=>{
  await preparedGame(page,'bench-tools');
  const slots=page.locator('.bench-slot');
  const a=await slots.nth(0).getAttribute('data-unit-id'), b=await slots.nth(1).getAttribute('data-unit-id');
  const from=(await slots.nth(0).boundingBox())!,to=(await slots.nth(1).boundingBox())!;
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.mouse.up();
  await expect(slots.nth(0)).toHaveAttribute('data-unit-id',b!);await expect(slots.nth(1)).toHaveAttribute('data-unit-id',a!);
  const odds=page.getByLabel('코스트별 상점 등장 확률');
  await expect(odds).toContainText('Lv.3');
  await expect(odds.locator('b')).toHaveText(['75%','25%','0%','0%','0%']);
  for(let i=0;i<3 && (await odds.innerText()).includes('Lv.3');i++) await page.getByRole('button',{name:/경험치 구매/}).click();
  await expect(odds).toContainText('Lv.4');
  await expect(odds.locator('b')).toHaveText(['55%','30%','15%','0%','0%']);
  await page.screenshot({path:info.outputPath('bench-swap-odds.png')});
});

test('duplicator appears, clones an unequipped legendary, then respects the remaining low-cost charge',async({page},info)=>{
  await preparedGame(page,'bench-tools');
  const slots=page.locator('.bench-slot'), high=await slots.nth(2).getAttribute('data-unit-id'), low=await slots.nth(0).getAttribute('data-unit-id');
  const lowName=await slots.nth(0).getByRole('img').getAttribute('alt');
  await expect(page.locator('.item-tools summary')).toContainText('복제기 2');
  await page.locator('.item-tools summary').click();
  await page.getByLabel('사용할 장비 도구').selectOption('CLONE');
  await page.getByLabel('장비 도구 대상').selectOption('unit:'+high);
  await page.getByRole('button',{name:'기물 복제 · 1개 사용'}).click();
  await expect(page.locator('.bench-slot.filled')).toHaveCount(5);
  await expect(page.locator('.item-tools summary')).toContainText('복제기 1');
  await expect(page.getByLabel('장비 도구 대상').locator('option').filter({hasText:'5코'})).toHaveCount(0);
  await page.getByLabel('장비 도구 대상').selectOption('unit:'+low);
  await page.getByRole('button',{name:'기물 복제 · 1개 사용'}).click();
  await expect(page.locator('.item-tools summary')).toContainText('복제기 0');
  await expect(page.locator('.bench-slot').filter({has:page.getByRole('img',{name:lowName!,exact:true})}).locator('.stars')).toHaveText('★★');
  await expect(page.getByRole('button',{name:'기물 복제 · 1개 사용'})).toBeDisabled();
  await page.screenshot({path:info.outputPath('clone-tools.png')});
});

test('phone odds include augment adjustments without hiding bench units',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await preparedGame(page,'bench-odds-augment');
  const odds=page.getByLabel('코스트별 상점 등장 확률');
  await odds.scrollIntoViewIfNeeded();
  await expect(odds.locator('b')).toHaveText(['71.25%','23.75%','0%','3%','2%']);
  expect(await odds.evaluate(e=>{const a=e.getBoundingClientRect();return a.left>=0 && a.right<=innerWidth;})).toBe(true);
  const unit=page.locator('.bench-slot.filled').first();await unit.click();
  await expect(page.locator('.detail-panel')).toBeVisible();
  await page.screenshot({path:info.outputPath('phone-bench-odds.png')});
});
