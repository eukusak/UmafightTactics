import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
const key = 'uma-fight-tactics-save-v1';
const saves = new Map<string, string>();
export async function preparedGame(page: Page, mode = 'default'): Promise<void> {
  if (!saves.has(mode)) saves.set(mode, execFileSync(process.execPath, ['--import', 'tsx', 'tests/support/browser-save.ts', mode], { encoding: 'utf8' }).trim());
  await page.goto('/');
  await page.evaluate(({ key, save }) => { localStorage.setItem(key, save); }, { key, save: saves.get(mode)! });
  await page.reload();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '이어하기' }).click();
  if (mode !== 'augment' && !mode.startsWith('result-')) await page.getByRole('button', { name: '준비 타이머 일시정지' }).click();
  await expect(page.locator('.dev-panel')).toHaveCount(0);
}
export async function fundSavedGame(page: Page): Promise<void> {
  await page.evaluate(key => { const save = JSON.parse(localStorage.getItem(key)!); save.match.players.find((p: { isHuman: boolean }) => p.isHuman).gold = 100; localStorage.setItem(key, JSON.stringify(save)); }, key);
  await page.reload(); await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.getByRole('button', { name: '준비 타이머 일시정지' }).click();
}
