import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';
test('solo exit saves prep, battle and augment choice and enables continue', async ({ page }) => {
  for (const mode of ['default', 'battle-exit', 'augment']) {
    await preparedGame(page, mode);
    if (mode === 'battle-exit') await page.getByRole('button', { name: /전투 시작/ }).click();
    await page.getByRole('button', { name: '메인 메뉴', exact: true }).click();
    await expect(page.getByRole('heading', { name: '트레이닝 센터' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이어하기' })).toBeEnabled();
    await page.getByRole('button', { name: '이어하기' }).click();
    await expect(page.getByRole('button', { name: '메인 메뉴', exact: true })).toBeVisible();
    if (mode === 'augment') await expect(page.locator('.augment-overlay')).toBeVisible();
  }
});
