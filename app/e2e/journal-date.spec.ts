import {test,expect} from '@playwright/test';
test('날짜별 일기를 저장하고 미저장 변경을 보호한다',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:'이 기기에만 저장하고 시작하기'}).click();
 const mobile=page.locator('.mobile-nav');await ((await mobile.isVisible())?mobile:page.locator('.sidebar nav')).getByRole('button',{name:'일기',exact:true}).click();
 await page.getByLabel('일기 날짜').fill('2026-01-02');
 await page.getByLabel('오늘의 일기').fill('지난날 기록');
 await page.locator('.journal-form').getByRole('button',{name:'저장',exact:true}).click();
 await page.getByRole('button',{name:'오늘로',exact:true}).click();
 await expect(page.getByLabel('오늘의 일기')).toHaveValue('');
 await page.getByLabel('오늘의 일기').fill('저장 전 내용');
 page.once('dialog',d=>d.dismiss());await page.getByLabel('일기 날짜').fill('2026-01-02');
 await expect(page.getByLabel('오늘의 일기')).toHaveValue('저장 전 내용');
 page.once('dialog',d=>d.accept());await page.getByLabel('일기 날짜').fill('2026-01-02');
 await expect(page.getByLabel('오늘의 일기')).toHaveValue('지난날 기록');
 await page.getByLabel('오늘의 일기').fill('수정된 기록');
 await page.locator('.journal-form').getByRole('button',{name:'저장',exact:true}).click();
 await page.getByRole('button',{name:'오늘로',exact:true}).click();
 await expect(page.locator('.journal-past')).toContainText('수정된 기록');
});
