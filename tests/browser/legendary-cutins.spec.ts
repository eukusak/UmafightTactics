import { test, expect } from '@playwright/test';

test('all eight legendary cut-ins load; demoted units have none; enhanced releases preview', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /모션/ }).click();
  await page.getByRole('button', { name: '스킬', exact: true }).click();
  for (const id of ['symboli_kris_s', 'symboli_rudolf', 'buena_vista', 'special_week', 'daiwa_scarlet', 'taiki_shuttle', 'tm_opera_o', 'mihono_bourbon']) {
    await page.getByLabel('기물 선택').selectOption(id);
    const details = page.locator('.legendary-cutin-preview');
    if (!await details.evaluate(e => e.hasAttribute('open'))) await details.locator('summary').click();
    const art = details.locator('img');
    await expect(art).toHaveAttribute('src', new RegExp('/characters/cutin/' + id + '.png'));
    await expect.poll(() => art.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 960 && i.naturalHeight === 540)).toBe(true);
    await expect(page.getByText('프레임 애니메이션 · 6종 모션 · 24개 원화', { exact: true })).toBeVisible();
    if (['buena_vista', 'taiki_shuttle'].includes(id)) {
      await page.waitForTimeout(350);
      await page.screenshot({ path: info.outputPath(id + '-legendary.png') });
    }
  }
  for (const id of ['maruzensky', 'kitasan_black', 'almond_eye']) {
    await page.getByLabel('기물 선택').selectOption(id);
    await expect(page.locator('.legendary-cutin-preview')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
