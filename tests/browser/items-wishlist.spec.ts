import { test, expect, type Page, type Locator } from '@playwright/test';
import { preparedGame } from './fixtures';

const component = (page: Page, index: number) => page.locator(`[data-touch-item="fixture-item-${index}"]`);
async function mouseOver(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!, b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2 + 1, b.y + b.height / 2);
}

test('mouse hold previews, cancels on leaving or early release, then crafts exactly once', async ({ page }, info) => {
  await preparedGame(page, 'components');
  await mouseOver(page, component(page, 0), component(page, 1));
  await expect(page.locator('.stored-item.combining')).toHaveCount(1);
  await page.mouse.move(800, 250); await page.mouse.up();
  await page.waitForTimeout(800);
  await expect(component(page, 0)).toHaveCount(1); await expect(component(page, 1)).toHaveAttribute('aria-label', '강화 편자');
  await mouseOver(page, component(page, 0), component(page, 1)); await page.mouse.up();
  await page.waitForTimeout(800); await expect(component(page, 0)).toHaveCount(1);
  await mouseOver(page, component(page, 0), component(page, 1));
  await expect(component(page, 0)).toHaveCount(0);
  await page.mouse.up();
  await expect(component(page, 1)).toHaveAttribute('aria-label', '삼박자 승부복');
  await expect(page.locator('[data-touch-item]')).toHaveCount(9);
  await page.screenshot({ path: info.outputPath('crafted-desktop.png') });
});

test('two component drops auto craft on bench and field with visible finished gear', async ({ page }, info) => {
  await preparedGame(page, 'components');
  const bench = page.locator('.bench-slot.filled').first();
  await component(page, 0).dragTo(bench); await component(page, 1).dragTo(bench);
  await expect(bench.locator('.items img')).toHaveCount(1);
  await expect(bench.locator('.items img')).toHaveAttribute('alt', '삼박자 승부복');
  await bench.hover(); await page.keyboard.press('w');
  const unit = page.locator('.arena-unit-touch').first();
  await component(page, 2).dragTo(unit); await component(page, 3).dragTo(unit);
  await expect(unit.locator('.arena-unit-items img')).toHaveCount(2);
  await expect(unit.locator('.arena-unit-items img').last()).toHaveAttribute('alt', '타오르는 투지의 작전서');
  await unit.click(); await expect(page.locator('.detail-panel')).toContainText('타오르는 투지의 작전서');
  await page.screenshot({ path: info.outputPath('equipped-field.png') });
});

test('wishlist checks mark matching shop cards, persist after reload, and clear immediately', async ({ page }, info) => {
  await preparedGame(page);
  const card = page.locator('.shop-card:not(.sold)').first();
  const name = await card.locator('.name').innerText();
  await page.locator('.wishlist-panel summary').click();
  await page.getByLabel('희망 기물 검색').fill(name);
  const checkbox = page.getByRole('checkbox', { name: `${name} 희망 기물`, exact: true });
  await checkbox.check(); await expect(card.locator('.wishlist-marker')).toBeVisible();
  await expect(card).toHaveClass(/wanted/);
  await page.getByLabel('희망 기물 코스트').selectOption('5');
  await expect(checkbox).toHaveCount(0);
  await page.getByLabel('희망 기물 코스트').selectOption('all'); await expect(checkbox).toBeChecked();
  await page.screenshot({ path: info.outputPath('wishlist-desktop.png') });
  await page.reload(); await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.getByRole('button', { name: '준비 타이머 일시정지' }).click();
  await expect(card.locator('.wishlist-marker')).toBeVisible();
  await page.locator('.wishlist-panel summary').click();
  await page.getByRole('button', { name: '이번 시즌 체크 해제' }).click();
  await expect(page.locator('.wishlist-marker')).toHaveCount(0);
});

test.describe('phone crafting and wishlist', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('touch holds cancel and complete; wishlist remains usable without horizontal overflow', async ({ page }, info) => {
    await preparedGame(page, 'components');
    await component(page, 0).scrollIntoViewIfNeeded();
    const a = (await component(page, 0).boundingBox())!, b = (await component(page, 1).boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const point = (box: typeof a) => [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(a) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(b) });
    await expect(page.locator('.stored-item.combining')).toHaveCount(1);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.waitForTimeout(800); await expect(component(page, 0)).toHaveCount(1);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(a) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(b) });
    await expect(component(page, 0)).toHaveCount(0);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
    await expect(component(page, 1)).toHaveAttribute('aria-label', '삼박자 승부복');
    // Allow the completed drag's click-suppression window to expire.
    await page.waitForTimeout(550);
    const name = await page.locator('.shop-card:not(.sold) .name').first().innerText();
    await page.locator('.wishlist-panel summary').tap(); await page.getByLabel('희망 기물 검색').fill(name);
    await page.getByRole('checkbox', { name: `${name} 희망 기물`, exact: true }).check();
    await expect(page.locator('.wishlist-marker').first()).toBeAttached();
    expect(await page.locator('.stage').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('wishlist-phone.png') });
  });
});
