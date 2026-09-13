import { expect, test } from '@playwright/test';
import { preparedGame } from './fixtures';

test('inspection highlights two and three stars after shop upgrades and shows increasing skill values', async ({page}, info) => {
  await preparedGame(page,'shop-upgrades');
  for(const [index,star] of [[0,2],[1,3]]) {
    const card=page.locator('.shop-card').nth(index);
    const name=await card.locator('.name').innerText();
    await card.click();
    const unit=page.locator('.arena-unit,.bench-slot').filter({has:page.getByRole('img',{name,exact:true})});
    await unit.click();
    const panel=page.locator('.detail-panel');
    await expect(panel.locator('.skill-values > strong')).toHaveText('성급별 스킬 수치 · 현재 '+star+'성');
    const table=panel.getByRole('table',{name:'성급별 스킬 수치'});
    await expect(table.locator('thead [data-current="true"]')).toHaveText(star+'성');
    const rows=await table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>Array.from(row.querySelectorAll('td')).map(td=>parseFloat(td.textContent!))));
    expect(rows.some(([a,b,c])=>a<b && b<c)).toBe(true);
    await table.scrollIntoViewIfNeeded();
    expect(await table.evaluate(t=>t.scrollWidth<=t.clientWidth+1)).toBe(true);
  }
  await page.screenshot({path:info.outputPath('three-star-skill-values.png')});
});

test('battle identifies the actual PvP opponent and follows scouting switches', async ({page},info) => {
  await preparedGame(page,'cutin-hud');
  await expect(page.getByLabel('현재 전투 상대')).toHaveCount(0);
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  const label=page.getByLabel('현재 전투 상대');
  await expect(label).toHaveText(/^VS AI [1-7]$/);
  const opponent=(await label.innerText()).replace('VS ','');
  await page.getByRole('button',{name:opponent+' 편성 확인',exact:true}).click();
  await expect(label).toHaveText(opponent+' VS 트레이너');
  await page.getByRole('button',{name:'내 필드로 돌아가기',exact:true}).click();
  await expect(label).toHaveText('VS '+opponent);
  expect(await label.evaluate(e=>{ const box=e.getBoundingClientRect(),field=e.closest('.field-surface')!.getBoundingClientRect();return box.left>=field.left && box.right<=field.right && box.top>=field.top; })).toBe(true);
  await page.screenshot({path:info.outputPath('battle-opponent.png')});
});

test('PvE shows the encounter name even when the player fields no units', async ({page}) => {
  await preparedGame(page);
  await page.getByRole('button',{name:/전투 시작 \(/}).click();
  await expect(page.getByLabel('현재 전투 상대')).toHaveText('VS 연습용 허수아비');
});
