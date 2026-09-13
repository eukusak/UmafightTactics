import { test, expect } from '@playwright/test';
import { preparedGame } from './fixtures';

test('owned augments open their description and permanent progress on click and keyboard', async ({page},info) => {
  await preparedGame(page,'augment-inspect');
  await page.getByRole('button',{name:'우라라의 응원 증강 상세'}).click();
  const detail=page.getByRole('region',{name:'상세 정보'});
  await expect(detail).toContainText('PvP 시전마다'); await expect(detail).toContainText('6 / 20중첩');
  const memory=page.getByRole('button',{name:'영구 작전 기록 증강 상세'}); await memory.focus(); await page.keyboard.press('Enter');
  await expect(detail).toContainText('영구 기록: 3중첩');
  await page.screenshot({path:info.outputPath('augment-details.png')});
});

test('game gestures suppress native menus and blue selection while text inputs still work', async ({page}) => {
  await preparedGame(page,'augment-inspect');
  const result=await page.locator('.hud-top').evaluate(element=>{
    const context=new MouseEvent('contextmenu',{bubbles:true,cancelable:true}); element.dispatchEvent(context);
    const select=new Event('selectstart',{bubbles:true,cancelable:true}); element.dispatchEvent(select);
    return {context:context.defaultPrevented,selection:select.defaultPrevented,userSelect:getComputedStyle(element).userSelect};
  });
  expect(result).toEqual({context:true,selection:true,userSelect:'none'});
  // Exercise the same root listeners with an editable field, without replacing them.
  const input=await page.locator('#root').evaluate(root=>{
    const input=document.createElement('input'); root.append(input); input.value='트레이너';input.focus();input.select();
    const context=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});input.dispatchEvent(context);
    const select=new Event('selectstart',{bubbles:true,cancelable:true});input.dispatchEvent(select);
    const result={context:context.defaultPrevented,selection:select.defaultPrevented,userSelect:getComputedStyle(input).userSelect,length:input.selectionEnd!-input.selectionStart!};input.remove();return result;
  });
  expect(input).toEqual({context:false,selection:false,userSelect:'text',length:4});
  const title=page.locator('.hud-top .stat').first(); const box=await title.boundingBox();
  await page.mouse.move(box!.x,box!.y+10); await page.mouse.down(); await page.mouse.move(box!.x+100,box!.y+10,{steps:5}); await page.mouse.up();
  expect(await page.evaluate(()=>window.getSelection()?.toString()??'')).toBe('');
});
