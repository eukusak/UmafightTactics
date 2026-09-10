import { test, expect } from '@playwright/test';

test('race-backed skills expose distinct patterns and render their timed frame previews', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: /모션/ }).click();
  await page.getByRole('button', { name: '스킬', exact: true }).click();
  for (const [id, label, race] of [
    ['special_week', '관통 돌파', '1999'],
    ['silence_suzuka', '지속 광선', '毎日王冠'],
    ['tokai_teio', '삼단 결정타', '1993'],
    ['oguri_cap', '집중 유성', '1990'],
    ['rice_shower', '흡수 요새', '1995'],
    ['haru_urara', '서리 전선', '2위'],
    ['fuji_kiseki', '확장 폭발', '1994'],
    ['gold_ship', '추격 연타', '2012'],
    ['daiwa_scarlet', '잔불 지대', '2008'],
    ['ines_fujin', '지구력 축적', '1990'],
    ['eishin_flash', '지연 봉쇄', '2010'],
    ['almond_eye', '삼단 결정타', '2020'],
    ['manhattan_cafe', '흡수 휩쓸기', '2001'],
  ]) {
    await page.getByLabel('기물 선택').selectOption(id);
    await expect(page.locator('.motion-skill-name')).toContainText(label);
    await expect(page.locator('.motion-skill-description')).toContainText(race);
    await expect(page.locator('.motion-preview canvas')).toBeVisible();
    await expect(page.getByText('프레임 애니메이션 · 6종 모션 · 24개 원화', { exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: info.outputPath(id + '-skill.png') });
  }
  expect(errors).toEqual([]);
});
