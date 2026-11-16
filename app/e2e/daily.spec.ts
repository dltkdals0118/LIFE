import {test,expect} from '@playwright/test';
test('설정 없이 작은 행동을 하고 새로고침해도 하루 기록이 남는다',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:'이 기기에만 저장하고 시작하기'}).click();
 await expect(page.getByRole('heading',{name:'오늘은 얼마나 여유 있어?'})).toBeVisible();
 await expect(page.locator('.daily-home input')).toHaveCount(0);
 await page.getByRole('button',{name:'거의 없어',exact:true}).click();
 await page.getByRole('button',{name:'더 작게',exact:true}).click();
 await expect(page.getByRole('heading',{name:'잠깐 멈추고 지금 기분만 확인하기'})).toBeVisible();
 await page.getByRole('button',{name:'했어',exact:true}).click();
 await expect(page.getByRole('heading',{name:'오늘은 여기까지.'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'오늘은 여기까지.'})).toBeVisible();
 await expect(page.getByRole('button',{name:'했어',exact:true})).toHaveCount(0);
 await page.screenshot({path:`test-results/daily-${test.info().project.name}.png`,fullPage:true});
});
test('쉬기를 선택하면 실패 과제나 입력을 요구하지 않는다',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:'이 기기에만 저장하고 시작하기'}).click();
 await page.getByRole('button',{name:'오늘은 쉬기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'오늘은 쉬기로 했어요'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'오늘은 쉬기로 했어요'})).toBeVisible();
});
