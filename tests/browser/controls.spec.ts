import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('/?dev=1');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByLabel('무작위 시드 사용').uncheck();
  await page.getByRole('button', { name: '게임 시작' }).click();
  await page.locator('.draft-card:not(:disabled)').first().click();
  await expect(page.locator('.draft-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: '준비 타이머 일시정지' }).click();
  await page.getByRole('button', { name: '+50G', exact: true }).click();
}
const gold = async (page: Page) => Number(await page.locator('.hud-top .stat').filter({ hasText: '골드' }).locator('b').innerText());
async function collapseDev(page: Page) {
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByLabel('개발자 패널').uncheck();
  await page.getByRole('button', { name: '돌아가기' }).click();
}
async function grantComponents(page: Page) {
  // The draft already grants one material. Equip it before adding ten so this
  // successful-sale scenario respects the real ten-slot storage limit.
  await page.locator('.hud-left [draggable="true"]').first().dragTo(page.locator('.bench-slot.filled').first());
  await page.getByRole('button', { name: '재료 10종', exact: true }).click();
}

async function buy(page: Page) {
  const count = await page.locator('.bench-slot.filled').count();
  await page.locator('.shop-card:not(.sold):not(:disabled)').first().click();
  await expect(page.locator('.bench-slot.filled')).toHaveCount(count + 1);
  return page.locator('.bench-slot.filled').last();
}

test('shop drag sells bench and field units, refunds gold and returns equipment', async ({ page }, info) => {
  await setup(page);
  await grantComponents(page);
  await collapseDev(page);
  const bench = await buy(page);
  await bench.click();
  const price = Number((await page.locator('.detail-sell').innerText()).match(/(\d+)G/)![1]);
  const component = page.locator('.hud-left [draggable="true"]').filter({ has: page.getByRole('button', { name: '강화 편자 설명과 조합식' }) });
  await component.dragTo(bench);
  await expect(page.locator('.detail-panel')).toContainText('장착 아이템 · 1/3');
  const id = await bench.getAttribute('data-unit-id');
  const before = await gold(page);
  await bench.dragTo(page.getByLabel('상점 판매 영역'), { targetPosition: { x: 70, y: 60 } });
  await expect(page.locator(`.bench-slot[data-unit-id="${id}"]`)).toHaveCount(0);
  expect(await gold(page)).toBe(before + price);
  await expect(page.locator('.hud-left').getByRole('button', { name: '강화 편자 설명과 조합식' })).toBeVisible();
  await expect(page.locator('.sell-overlay')).toHaveCount(0);

  const next = await buy(page);
  const nextId = await next.getAttribute('data-unit-id');
  await next.hover(); await page.keyboard.press('w');
  const field = page.locator(`.arena-unit[data-unit-id="${nextId}"] .arena-unit-touch`);
  await expect(field).toBeVisible();
  await field.click();
  const fieldPrice = Number((await page.locator('.detail-sell').innerText()).match(/(\d+)G/)![1]);
  const beforeField = await gold(page);
  await field.dragTo(page.getByLabel('상점 판매 영역'));
  await expect(field).toHaveCount(0);
  expect(await gold(page)).toBe(beforeField + fieldPrice);
  await page.screenshot({ path: info.outputPath('drag-sale.png') });
});

test('keyboard supports Korean physical keys, uppercase, E/W, custom bindings and typing guards', async ({ page }) => {
  await setup(page);
  const beforeTyping = await gold(page);
  await page.getByPlaceholder('유닛 검색').pressSequentially('defw');
  expect(await gold(page)).toBe(beforeTyping);
  await page.getByPlaceholder('유닛 검색').fill('');
  await collapseDev(page);
  await page.locator('.hud-top').click();
  await page.locator('body').dispatchEvent('keydown', { key: 'ㅇ', code: 'KeyD', bubbles: true });
  expect(await gold(page)).toBe(beforeTyping - 2);
  await page.keyboard.press('Shift+F');
  expect(await gold(page)).toBe(beforeTyping - 6);
  await page.locator('body').dispatchEvent('keydown', { key: 'd', code: 'KeyD', repeat: true, bubbles: true });
  expect(await gold(page)).toBe(beforeTyping - 6);
  await page.keyboard.press('Control+d');
  expect(await gold(page)).toBe(beforeTyping - 6);
  const unit = await buy(page), id = await unit.getAttribute('data-unit-id');
  await unit.hover(); await page.keyboard.press('w');
  const field = page.locator(`.arena-unit[data-unit-id="${id}"] .arena-unit-touch`);
  await expect(field).toBeVisible();
  await field.hover(); await page.keyboard.press('w');
  await expect(field).toHaveCount(0);
  const returned = page.locator(`.bench-slot[data-unit-id="${id}"]`);
  await returned.hover(); await page.keyboard.press('e');
  await expect(returned).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.locator('.detail-panel')).toContainText('전투 통계');
  await page.keyboard.press('Escape');
  await expect(page.locator('.detail-panel')).toHaveCount(0);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('button', { name: 'd', exact: true }).click();
  await page.keyboard.press('z');
  await page.getByRole('button', { name: '돌아가기' }).click();
  const beforeRebind = await gold(page);
  await page.keyboard.press('z');
  expect(await gold(page)).toBe(beforeRebind - 2);
  await page.keyboard.press('d');
  expect(await gold(page)).toBe(beforeRebind - 2);
});

test('unit selection inspects without moving another unit; gear updates stats; traits and recipes open on right', async ({ page }, info) => {
  await setup(page);
  await grantComponents(page);
  await collapseDev(page);
  const unit = await buy(page), id = await unit.getAttribute('data-unit-id');
  await unit.hover(); await page.keyboard.press('w');
  const field = page.locator(`.arena-unit[data-unit-id="${id}"] .arena-unit-touch`);
  await field.click();
  const panel = page.getByRole('region', { name: '상세 정보', exact: true });
  for (const label of ['체력', '마나', '공격력', '주문력', '방어력', '마법저항력', '공격속도', '사거리', '장착 아이템']) await expect(panel).toContainText(label);
  const armor = panel.locator('.detail-stats > div').filter({ has: page.locator('dt', { hasText: /^방어력$/ }) }).locator('dd');
  const beforeArmor = Number(await armor.innerText());
  const component = page.locator('.hud-left [draggable="true"]').filter({ has: page.getByRole('button', { name: '강화 편자 설명과 조합식' }) });
  await component.dragTo(field);
  await expect(armor).toHaveText(String(beforeArmor + 20));
  await page.screenshot({ path: info.outputPath('unit-detail.png') });
  const other = await buy(page), otherId = await other.getAttribute('data-unit-id');
  await other.click();
  await field.click({ button: 'right' });
  await expect(page.locator(`.bench-slot[data-unit-id="${otherId}"]`)).toHaveCount(1);
  await expect(field).toBeVisible();
  await page.locator('.trait-row').first().click();
  await expect(panel).toContainText('배치');
  await expect(panel).toContainText('이번 시즌의 해당 기물');
  await page.screenshot({ path: info.outputPath('trait-detail.png') });
  await page.locator('.hud-left').getByRole('button', { name: '우승자 리본 설명과 조합식' }).first().click();
  await expect(panel.locator('.detail-recipe-card')).toHaveCount(10);
  await expect(panel).toContainText('공격력 +10%');
  await panel.getByRole('button', { name: /챔피언 트로피/ }).click();
  await expect(panel).toContainText('조합식');
  await expect(panel.getByRole('button', { name: /우승자 리본/ })).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('item-recipe.png') });
  const bounds = await panel.boundingBox(), viewport = page.viewportSize()!;
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
});

test('battle units remain inspectable; field sale is blocked; bench sale still works', async ({ page }) => {
  await setup(page); await collapseDev(page);
  const unit = await buy(page), unitId = await unit.getAttribute('data-unit-id');
  await unit.hover(); await page.keyboard.press('w');
  const bench = await buy(page), benchId = await bench.getAttribute('data-unit-id');
  await page.getByRole('button', { name: /전투 시작 \(/ }).click();
  await expect(page.locator('.battle-inspect-target').first()).toBeVisible();
  await page.locator(`.battle-inspect-target[data-combat-id="p1#${unitId}"]`).click();
  await expect(page.locator('.detail-sell')).toBeDisabled();
  await expect(page.locator('.detail-panel')).toContainText('전투 중 현재 능력치');
  await page.keyboard.press('Tab');
  await expect(page.locator('.detail-panel')).toContainText('전투 통계');
  await page.locator(`.bench-slot[data-unit-id="${benchId}"]`).hover();
  await page.keyboard.press('e');
  await expect(page.locator(`.bench-slot[data-unit-id="${benchId}"]`)).toHaveCount(0);
});
