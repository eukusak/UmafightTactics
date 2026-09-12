import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('nine sprinters show their final tier and the two required extra members', async ({ page }, info) => {
  await preparedGame(page, 'trait-chase');
  const trait = page.locator('.trait-row').filter({ hasText: '스프린터' });
  await expect(trait).toContainText('9명 · 4/4단계');
  await trait.click();
  await expect(page.locator('.trait-chase-note')).toContainText('최소 2명 보강 필요');
  await expect(page.locator('.detail-tier.active')).toContainText('9명');
  await page.screenshot({ path: info.outputPath('trait-final-tier.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('motion preview identifies cost effects and renders promoted legendary portraits', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /모션/ }).click();
  await page.getByRole('button', { name: '스킬', exact: true }).click();
  for (const [id, cost, label] of [['haru_urara', 1, '기본'], ['maruzensky', 4, '영웅'], ['symboli_rudolf', 5, '전설'], ['buena_vista', 5, '전설']]) {
    await page.getByLabel('기물 선택').selectOption(String(id));
    await expect(page.locator('.motion-cost')).toHaveText(`${cost}코스트 · ${label} 이펙트`);
    await expect(page.getByText('프레임 애니메이션 · 6종 모션 · 24개 원화', { exact: true })).toBeVisible();
    await page.waitForTimeout(550);
    await page.screenshot({ path: info.outputPath(`${id}-cost-effect.png`) });
  }
  expect(errors).toEqual([]);
});
