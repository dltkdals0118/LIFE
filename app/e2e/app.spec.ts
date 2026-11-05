import {test,expect} from '@playwright/test';
test('demo can complete a quest, browse map and inspect ABC without changing reality',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./');await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();await expect(page.getByRole('heading',{name:'오늘도, 나의 속도로'})).toBeVisible();
 await page.getByRole('button',{name:/완료했어요/}).click();await page.getByRole('button',{name:/끝까지 했어요/}).click();await expect(page.getByRole('status')).toContainText(/\+\d+ XP/);
 await page.getByRole('button',{name:'나의 플랜 살펴보기'}).click();await expect(page.getByRole('heading',{name:'목표와 플랜 ABC'})).toBeVisible();await page.getByRole('button',{name:'상황을 바꿔 비교하기'}).click();await page.getByLabel('주간 가용시간 가정').fill('0');await expect(page.getByRole('dialog')).toContainText('시간 부족');await page.getByRole('button',{name:'닫기',exact:true}).click();expect(errors).toEqual([]);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
});
test('personal quest and observation survive reload, review and rewards work',async({page})=>{
 await page.goto('./');await page.getByRole('button',{name:'이 기기에만 저장하고 시작하기'}).click();await page.getByRole('button',{name:'첫 퀘스트 만들기'}).click();await page.getByLabel('어떤 한 걸음을 내딛을까요?').fill('테스트 산책');await page.getByLabel('완료했다고 말할 수 있는 기준').fill('10분 걸었다');await page.getByRole('button',{name:'저장하기',exact:true}).click();await expect(page.getByText('테스트 산책',{exact:true})).toBeVisible();await page.getByRole('button',{name:/완료했어요/}).click();await page.getByRole('button',{name:/끝까지 했어요/}).click();
 await page.getByRole('button',{name:'빠른 기록',exact:true}).click();await page.getByLabel('값',{exact:true}).fill('1250000');await page.getByRole('button',{name:'저장하기',exact:true}).click();await expect(page.getByRole('status')).toContainText('저장');await page.waitForTimeout(300);await page.reload();await expect(page.getByRole('button',{name:'이 기기에만 저장하고 시작하기'})).toHaveCount(0);await expect(page.getByText('1개',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'회고 남기기',exact:true}).click();await page.getByLabel('작지만 잘해낸 일').fill('걸었다');await page.getByLabel('다음 주의 한 걸음').fill('다시 걷기');await page.getByRole('button',{name:'저장하기',exact:true}).click();
 await page.getByRole('button',{name:'보상함 열어보기'}).click();await page.getByRole('button',{name:'보상 추가'}).click();await page.getByLabel('어떤 보상이 기다려지나요?').fill('공원 가기');await page.getByLabel('잠금 해제 경험치').fill('0');await page.getByRole('button',{name:'저장하기',exact:true}).click();await page.getByRole('button',{name:'보상 예약하기'}).click();await expect(page.getByText('예약됨',{exact:true})).toBeVisible();
});
test('desktop and mobile screenshots',async({page},info)=>{await page.goto('./');await expect(page.getByRole('heading',{name:'다시 만나 반가워요'})).toBeVisible();await page.screenshot({path:`test-results/${info.project.name}-login.png`,fullPage:true});await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();await page.getByRole('heading',{name:'오늘도, 나의 속도로'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-home.png`,fullPage:true});if(info.project.name==='desktop'){await page.getByRole('button',{name:'퀘스트'}).first().click();await page.getByRole('heading',{name:'나의 퀘스트'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-quests.png`,fullPage:true});await page.getByRole('button',{name:'나의 기록'}).first().click();await page.getByRole('heading',{name:'현금의 흐름'}).waitFor();await page.waitForTimeout(1400);await page.screenshot({path:`test-results/${info.project.name}-records.png`,fullPage:true});await page.getByRole('button',{name:'보상함'}).first().click();await page.getByRole('heading',{name:'나를 위한 보상함'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-rewards.png`,fullPage:true});await page.getByRole('button',{name:'목표와 플랜'}).first().click();await page.getByRole('heading',{name:'목표와 플랜 ABC'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-plans.png`,fullPage:true});}});

// 2026-11-03 요청: "일별 퀘스트 하나 띄워주고 그걸 완료하면 다음 퀘스트 / 가끔가다 서브 퀘스트",
// "레벨업 했을 때 세지는 정도". 화면이 실제로 그렇게 도는지를 사람 경로 그대로 확인한다.
test('게임 루프 — 하나씩 나오고, 레벨업에 전투력이 점프하고, 다 끝내면 보너스가 열린다',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await page.getByRole('button',{name:'이 기기에만 저장하고 시작하기'}).click();

 // 전투력은 분야 6개 × Lv.1 × 10 = 60 에서 시작한다
 await expect(page.getByText('전투력',{exact:true}).first()).toBeVisible();
 await expect(page.locator('.power-value')).toHaveText('60');

 const make=async(title:string,xp:string)=>{
  await page.getByRole('button',{name:/퀘스트 (만들기|추가)/}).first().click();
  await page.getByLabel('어떤 한 걸음을 내딛을까요?').fill(title);
  await page.getByLabel('완료했다고 말할 수 있는 기준').fill(`${title} 했다`);
  await page.locator('select[name="domain"]').selectOption('recovery');
  await page.locator('select[name="xp"]').selectOption(xp);
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
 };
 for(const n of ['운동1','운동2','운동3','운동4']) await make(n,'30');

 // **한 번에 하나만.** 둘을 만들었는데 오늘 화면에는 하나만 크게 뜨고 나머지는 '다음'으로만 보인다.
 await expect(page.locator('.focus-card h3')).toHaveCount(1);
 await expect(page.locator('.next-teaser strong')).toHaveCount(1);
 const first=await page.locator('.focus-card h3').innerText();

 // 끝내면 다음 것이 그 자리에 올라온다. 90 XP 까지는 레벨업이 없다.
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:/완료했어요/}).click();
  await page.getByRole('button',{name:/끝까지 했어요/}).click();
  await expect(page.locator('.levelup-card')).toHaveCount(0);
 }
 await expect(page.locator('.focus-card h3')).not.toHaveText(first);
 await expect(page.locator('.power-value')).toHaveText('60');

 // 네 번째로 120 XP → recovery Lv.2 → 체력 10→20 → 전투력 60→70 이 '점프'로 보인다
 await page.getByRole('button',{name:/완료했어요/}).click();
 await page.getByRole('button',{name:/끝까지 했어요/}).click();
 const up=page.locator('.levelup-card');
 await expect(up).toBeVisible({timeout:10000});
 await expect(up).toContainText('체력');
 await expect(up).toContainText('10 →');
 await expect(up.locator('.levelup-after')).toHaveText('70');
 await page.getByRole('button',{name:'계속하기'}).click();
 await expect(page.locator('.power-value')).toHaveText('70');

 // 남은 퀘스트가 0 이고 오늘 한 게 있으니 보너스가 열린다
 const bonus=page.locator('.bonus-card');
 await expect(bonus).toBeVisible();
 await bonus.getByRole('button',{name:/받기/}).click();
 // 받으면 그게 오늘의 퀘스트가 되고 보너스 자리는 닫힌다 (하루에 하나)
 await expect(page.locator('.focus-card h3')).toContainText('보너스 —');
 await expect(page.locator('.bonus-card')).toHaveCount(0);
 expect(errors).toEqual([]);
});

// 2026-11-05: 하단 탭이 넷만 보여줘서 주간 회고·나의 기록·목표와 플랜에 갈 수 없었다.
// 사용자는 그걸 '없어졌다'고 읽었다. 화면이 전부 닿는지 기계가 센다.
test('모바일 하단 탭으로 모든 화면에 갈 수 있다',async({page},info)=>{
 test.skip(info.project.name!=='mobile','모바일 전용');
 await page.goto('./');
 await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();
 const tabs=page.locator('.mobile-nav>button');
 await expect(tabs).toHaveCount(7);
 for(const [label,heading] of [['오늘','오늘도, 나의 속도로'],['성장 지도','나의 성장 지도'],
  ['목표와 플랜','목표와 플랜 ABC'],['퀘스트','나의 퀘스트'],['나의 기록','나의 기록'],
  ['주간 회고','잠깐, 돌아보기'],['보상함','나를 위한 보상함']] as const){
  await page.locator('.mobile-nav').getByRole('button',{name:label}).click();
  await expect(page.getByRole('heading',{name:heading})).toBeVisible();
 }
 const over=await page.evaluate(()=>{const n=document.querySelector('.mobile-nav')!;return n.scrollWidth>n.clientWidth+1;});
 expect(over,'하단 탭이 가로로 넘친다').toBe(false);
});

// 가로 넘침은 모바일에서 조용히 치명적이다: 브라우저가 페이지를 축소하고
// **고정 하단 탭이 화면 밖으로 밀려 안 눌린다.** 기록 이력 표(539px)가 실제로 그랬다.
// 화면마다 재서, 안쪽 스크롤로 가려진 경우까지 잡는다.
test('모바일 어느 화면에서도 가로로 넘치지 않는다',async({page},info)=>{
 test.skip(info.project.name!=='mobile','모바일 전용');
 await page.goto('./');
 await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();
 for(const tab of ['오늘','성장 지도','목표와 플랜','퀘스트','나의 기록','주간 회고','보상함']){
  await page.locator('.mobile-nav').getByRole('button',{name:tab}).click();
  await page.waitForTimeout(250);
  const m=await page.evaluate(()=>{const d=document.documentElement;
   return {over:d.scrollWidth-d.clientWidth,navTop:document.querySelector('.mobile-nav')!.getBoundingClientRect().top,vh:window.innerHeight};});
  expect(m.over,`${tab} 화면이 가로로 ${m.over}px 넘친다`).toBeLessThanOrEqual(0);
  expect(m.navTop,`${tab} 화면에서 하단 탭이 뷰포트 밖으로 밀렸다`).toBeLessThan(m.vh);
 }
});
