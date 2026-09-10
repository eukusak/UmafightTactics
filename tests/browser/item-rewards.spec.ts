import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('claims radiant and artifact rewards once, displays their tier and equips them', async ({
  page,
}, info) => {
  await preparedGame(page, 'item-rewards');
  const radiant = page.locator('.item-reward').filter({ hasText: '찬란한 장비 보상' });
  await radiant.locator('summary').click();
  await radiant.getByLabel('찬란한 장비 선택').selectOption('radiant_giant_overtaker');
  await expect(radiant).toContainText('현재 체력 6%');
  await radiant.getByRole('button', { name: '선택한 장비 받기' }).click();
  await expect(radiant).toHaveCount(0);
  const artifact = page.locator('.item-reward').filter({ hasText: '유물 보상' });
  await artifact.locator('summary').click();
  await artifact.getByLabel('유물 선택').selectOption('artifact_moon_chime');
  await expect(artifact).toContainText('아이템 회복은 연쇄 발동하지 않는다');
  await artifact.getByRole('button', { name: '선택한 장비 받기' }).click();
  await expect(page.locator('.item-reward')).toHaveCount(0);
  const items = page.locator('[data-touch-item]');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('찬');
  await expect(items.last()).toContainText('유');
  await items.first().dragTo(page.locator('.bench-slot.filled').first());
  await expect(page.locator('.bench-slot.filled .items img').first()).toHaveAttribute(
    'alt',
    '찬란한 · 거인 추월자',
  );
  await items.first().getByRole('button').click();
  await expect(page.locator('.detail-panel')).toContainText('유물 · 4-7 승리 보상');
  await page.screenshot({ path: info.outputPath('item-reward-tiers.png') });
});
