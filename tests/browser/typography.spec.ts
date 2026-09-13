import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

for (const mobile of [false, true]) test('rounded labels and readable augment paragraphs' + (mobile ? ' on mobile' : ''), async ({ page }, info) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await preparedGame(page, 'augment'); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.choice-card')).toHaveCount(3);
  await expect(page.locator('.choice-card h4').first()).toHaveCSS('font-family', /Jua/);
  await expect(page.locator('.choice-card .effect-copy').first()).toHaveCSS('font-family', /Noto Sans KR/);
  expect(await page.locator('.effect-sentence').count()).toBeGreaterThanOrEqual(3);
  const overflow = await page.locator('.choice-card h4, .choice-card .effect-copy, .augment-reroll').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.textContent));
  expect(overflow).toEqual([]);
  await page.screenshot({ path: info.outputPath('rounded-augment-copy.png'), fullPage: true });
});
