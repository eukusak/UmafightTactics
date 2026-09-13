import { expect, test } from '@playwright/test';
import { preparedGame } from './fixtures';

test('match augments update skill and item descriptions with star scaling and saved progress',async({page},info)=>{
  await preparedGame(page,'augment-descriptions');
  await page.locator('.bench-slot').filter({has:page.getByRole('img',{name:'하루 우라라',exact:true})}).click();
  const panel=page.locator('.detail-panel');
  await expect(panel.locator('.match-skill-description')).toContainText('잃은 체력 18% 회복');
  const changes=panel.getByLabel('이 기물의 증강 효과');
  await expect(changes).toContainText('6/20중첩');
  await expect(changes).toContainText('다음 전투 +72');
  await expect(changes).toContainText('스킬 치명타 가능');
  await changes.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('augmented-skill-description.png')});
  await panel.locator('.detail-item-link').filter({hasText:'연승 사냥꾼의 트로피'}).click();
  const item=panel.locator('.match-item-description');
  await expect(item).toContainText('이번 경기 변경 효과');
  await expect(item).toContainText('3/4중첩');
  await expect(item).toContainText('공격력 +18%');
  await expect(item).toContainText('잃은 체력 15% 회복');
  await expect(item).not.toContainText('전투당 최대 4중첩');
  await item.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('augmented-item-description.png')});
});

test('scouted units and items use their own augments, and the next match retains base descriptions',async({page})=>{
  await preparedGame(page,'augment-descriptions');
  await page.getByRole('button',{name:'AI 1 편성 확인',exact:true}).click();
  await page.getByRole('button',{name:'하루 우라라 정보',exact:true}).click();
  const panel=page.locator('.detail-panel');
  await expect(panel.getByLabel('이 기물의 증강 효과')).toHaveCount(0);
  await panel.locator('.detail-item-link').filter({hasText:'연승 사냥꾼의 트로피'}).click();
  await expect(panel.locator('.match-item-description')).not.toContainText('이번 경기 변경 효과');
  await expect(panel.locator('.match-item-description')).toContainText('전투당 최대 4중첩');
  await page.getByRole('button',{name:'내 필드로 돌아가기',exact:true}).click();
  await page.locator('.bench-slot').filter({has:page.getByRole('img',{name:'하루 우라라',exact:true})}).click();
  await expect(panel.getByLabel('이 기물의 증강 효과')).toContainText('6/20중첩');
  await preparedGame(page);
  await page.locator('.bench-slot.filled').first().click();
  await expect(page.getByLabel('이 기물의 증강 효과')).toHaveCount(0);
});
