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
test('desktop and mobile screenshots',async({page},info)=>{await page.goto('./');await expect(page.getByRole('heading',{name:'다시 만나 반가워요'})).toBeVisible();await page.screenshot({path:`test-results/${info.project.name}-login.png`,fullPage:true});await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();await page.getByRole('heading',{name:'오늘도, 나의 속도로'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-home.png`,fullPage:true});if(info.project.name==='desktop'){await page.getByRole('button',{name:'퀘스트'}).first().click();await page.getByRole('heading',{name:'나의 퀘스트'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-quests.png`,fullPage:true});await page.getByRole('button',{name:'나의 기록'}).first().click();await page.getByRole('heading',{name:'현금의 흐름'}).waitFor();await page.waitForTimeout(1400);await page.screenshot({path:`test-results/${info.project.name}-records.png`,fullPage:true});await page.getByRole('button',{name:'보상함'}).first().click();await page.getByRole('heading',{name:'나를 위한 보상함'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-rewards.png`,fullPage:true});await page.getByRole('button',{name:'목표와 플랜'}).first().click();await page.getByRole('heading',{name:'목표와 플랜 ABC'}).waitFor();await page.screenshot({path:`test-results/${info.project.name}-plans.png`,fullPage:true});await page.getByRole('button',{name:'시뮬레이션'}).first().click();await page.getByRole('heading',{name:/앞으로 \d+달/}).waitFor();await page.waitForTimeout(400);await page.screenshot({path:`test-results/${info.project.name}-sim.png`,fullPage:true});}});

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

// 2026-11-09 사용자: "시뮬레이션이 아니라 그냥 기록 -> 퀘스트 -> 보상 구조잖아."
// 시뮬레이션의 조건은 하나다 — **고른 것에 따라 결과가 바뀌고, 그걸 직접 돌려볼 수 있어야 한다.**
// 그래서 '손잡이를 당기면 숫자와 선이 움직이는지' 를 잰다.
test('시뮬레이션 — 손잡이를 당기면 결과가 바뀐다',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();
 // 모바일에선 사이드바가 화면 밖이라 .first() 가 안 보이는 버튼을 집는다. **보이는 쪽**을 누른다.
 const nav=await page.locator('.mobile-nav').isVisible()?page.locator('.mobile-nav'):page.locator('.sidebar nav');
 await nav.getByRole('button',{name:'시뮬레이션'}).click();
 await expect(page.getByRole('heading',{name:/앞으로 \d+달/})).toBeVisible();

 const head=page.locator('.sim-head b');
 const before=await head.nth(1).innerText();          // 마지막 달 현금
 const zeroBefore=await head.nth(0).innerText();      // 0 아래로 가는 달
 await expect(page.locator('.sim-line-mine')).toBeVisible();

 // 아무것도 안 당긴 상태에서는 '성립하려면' 목록이 비어 있다
 await expect(page.getByRole('heading',{name:'아직 아무 손잡이도 안 당겼어요'})).toBeVisible();

 // 손잡이 하나를 당기면 숫자가 바뀐다
 await page.locator('.sim-lever').first().getByRole('button',{name:/월 80만/}).click();
 await expect(head.nth(1)).not.toHaveText(before);
 // 그리고 '무엇이 참이어야 하는가' 가 나타난다
 await expect(page.getByText('주 단위 상한을 정하고 지킨다')).toBeVisible();
 // 묶음이 보이고, 당긴 개수가 세어진다
 await expect(page.locator('.sim-group-head h3').first()).toBeVisible();
 await expect(page.locator('.sim-group-count').first()).toHaveText(/^1\//);

 // 최선으로 맞추면 더 좋아지고, 0 아래로 가는 시점이 밀리거나 사라진다
 await page.getByRole('button',{name:'최선으로 맞추기'}).click();
 const after=await head.nth(1).innerText();
 const num=(t:string)=>Number(t.replace(/[^0-9-]/g,''));
 expect(num(after)).toBeGreaterThan(num(before));
 expect(await head.nth(0).innerText()).not.toBe(zeroBefore);

 // 되돌리면 처음으로
 await page.getByRole('button',{name:'되돌리기'}).click();
 await expect(head.nth(1)).toHaveText(before);
 expect(errors).toEqual([]);
});

// 2026-11-09: 예시 공간에서 가져오기를 하면 저장되지 않는데 앱이 말해주지 않았다.
// 사용자가 "가져왔는데" 라고 했지만 실제로는 아무것도 남지 않았다.
test('예시 공간에 가져오면 저장되지 않는다고 먼저 말한다',async({page})=>{
 await page.goto('./');
 await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();
 // 모바일에선 사이드바가 숨어 있다 — 햄버거를 먼저 연다
 if(await page.locator('.mobile-nav').isVisible())await page.getByRole('button',{name:'메뉴 열기'}).click();
 await page.getByRole('button',{name:'설정과 동기화'}).first().click();
 const file={schemaVersion:1,name:'가져오기 시험',chapter:'시험',
  domains:[{id:'finance',name:'재정 운영',color:'sage',icon:'wallet'}],
  quests:[],plans:[],observations:[],rewards:[],reviews:[],rewardBudget:null,events:[],
  sim:{asOf:'2026-11-09',cash:1000000,netMonthly:-500000,startMonth:'2026-12',months:6,
   flowBasis:'시험',incomeNow:null,groups:[],
   levers:[{id:'a',name:'레버',group:'',starts:'2026-12',basis:'',
     options:[{key:'A',label:'줄인다',delta:100000,requires:['무언가 한다']},
              {key:'C',label:'그대로',delta:0,requires:[]}]}]}};
 await page.setInputFiles('input[type=file]',{name:'import.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(file),'utf8')});
 const d=page.getByRole('dialog');
 await expect(d).toContainText('손잡이 1개');                    // 시뮬레이션이 들어 있는지 보여준다
 await expect(d).toContainText('지금은 예시 공간이에요');          // 그리고 저장되지 않는다고 말한다
 await expect(d.getByRole('button',{name:'이 기록으로 교체'})).toHaveCount(0);
 await d.getByRole('button',{name:'내 공간으로 바꾸기'}).click();
 await expect(page.getByRole('status')).toContainText('내 공간으로 바꿨어요');
});
