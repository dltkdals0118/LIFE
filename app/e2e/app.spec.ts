import {test, expect, type Page} from '@playwright/test';

// 2026-11-09 개편: 앱은 **시뮬레이션과 일기** 둘이다.
// 기록->퀘스트->보상 구조를 걷어냈으므로 그 화면들의 시험도 함께 지웠다.

/** 모바일에선 사이드바가 화면 밖이라 .first() 가 안 보이는 버튼을 집는다. 보이는 쪽을 누른다. */
async function go(page: Page, label: string) {
  const bar = page.locator('.mobile-nav');
  const nav = (await bar.isVisible()) ? bar : page.locator('.sidebar nav');
  await nav.getByRole('button', {name: label}).click();
}

test('시뮬레이션 — 손잡이를 당기면 결과가 바뀐다', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', {name: '로그인 없이 둘러보기'}).click();
  await expect(page.getByRole('heading', {name: /앞으로 \d+달/})).toBeVisible();

  const head = page.locator('.sim-head b');
  const before = await head.nth(1).innerText();       // 마지막 달 현금
  const zeroBefore = await head.nth(0).innerText();   // 0 아래로 가는 달
  await expect(page.locator('.sim-line-mine')).toBeVisible();

  // 아무것도 안 당긴 상태에서는 '성립하려면' 목록이 비어 있다
  await expect(page.getByRole('heading', {name: '아직 아무 손잡이도 안 당겼어요'})).toBeVisible();

  // 손잡이 하나를 당기면 숫자가 바뀌고, 무엇이 참이어야 하는지가 나타난다
  await page.locator('.sim-lever').first().getByRole('button', {name: /월 80만/}).click();
  await expect(head.nth(1)).not.toHaveText(before);
  await expect(page.getByText('주 단위 상한을 정하고 지킨다')).toBeVisible();
  await expect(page.locator('.sim-group-head h3').first()).toBeVisible();
  await expect(page.locator('.sim-group-count').first()).toHaveText(/^1\//);

  // 최선으로 맞추면 더 좋아지고, 되돌리면 처음으로
  await page.getByRole('button', {name: '최선으로 맞추기'}).click();
  const after = await head.nth(1).innerText();
  const num = (t: string) => Number(t.replace(/[^0-9-]/g, ''));
  expect(num(after)).toBeGreaterThan(num(before));
  expect(await head.nth(0).innerText()).not.toBe(zeroBefore);
  await page.getByRole('button', {name: '되돌리기'}).click();
  await expect(head.nth(1)).toHaveText(before);
  expect(errors).toEqual([]);
});

test('일기 — 하루 한 번, 새로고침해도 남고, 같은 날은 덮어쓴다', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', {name: '이 기기에만 저장하고 시작하기'}).click();
  await go(page, '일기');
  await expect(page.getByRole('heading', {name: '일기', exact: true})).toBeVisible();

  await page.getByLabel('오늘의 일기').fill('첫 줄을 적었다.');
  await page.locator('select[name=mood]').selectOption('4');
  await page.locator('.journal-form').getByRole('button', {name: '저장'}).click();
  await expect(page.getByRole('status')).toContainText('일기를 남겼어요');

  // 새로고침해도 남는다 (기기 저장)
  await page.waitForTimeout(400);
  await page.reload();
  await go(page, '일기');
  await expect(page.getByLabel('오늘의 일기')).toHaveValue('첫 줄을 적었다.');
  await expect(page.locator('select[name=mood]')).toHaveValue('4');

  // 같은 날 다시 쓰면 덮어쓴다 — 두 개가 되지 않는다
  await page.getByLabel('오늘의 일기').fill('고쳐서 다시 적었다.');
  await page.locator('.journal-form').getByRole('button', {name: '저장'}).click();
  await expect(page.getByRole('status')).toContainText('일기를 남겼어요');
  await expect(page.locator('.journal-past')).toHaveCount(0);   // 오늘 것은 '지난 일기'에 안 들어간다
  await expect(page.getByLabel('오늘의 일기')).toHaveValue('고쳐서 다시 적었다.');

  // 연속일이 메뉴에 뜬다
  await expect(page.locator('.sidebar nav, .mobile-nav').getByText('1일')).toBeVisible();
  expect(errors).toEqual([]);
});

test('예시 공간에 가져오면 저장되지 않는다고 먼저 말한다', async ({page}) => {
  await page.goto('./');
  await page.getByRole('button', {name: '로그인 없이 둘러보기'}).click();
  // 모바일에선 사이드바가 숨어 있다 — 햄버거를 먼저 연다
  if (await page.locator('.mobile-nav').isVisible()) await page.getByRole('button', {name: '메뉴 열기'}).click();
  await page.getByRole('button', {name: '설정과 동기화'}).first().click();
  const file = {
    schemaVersion: 1, name: '가져오기 시험', chapter: '시험',
    domains: [{id: 'finance', name: '재정 운영', color: 'sage', icon: 'wallet'}],
    quests: [], plans: [], observations: [], rewards: [], reviews: [], rewardBudget: null,
    journal: [], events: [],
    sim: {asOf: '2026-11-09', cash: 1000000, netMonthly: -500000, startMonth: '2026-12', months: 6,
      flowBasis: '시험', incomeNow: null, groups: [],
      levers: [{id: 'a', name: '레버', group: '', starts: '2026-12', basis: '',
        options: [{key: 'A', label: '줄인다', delta: 100000, requires: ['무언가 한다']},
                  {key: 'C', label: '그대로', delta: 0, requires: []}]}]},
  };
  await page.setInputFiles('input[type=file]', {name: 'import.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file), 'utf8')});
  const d = page.getByRole('dialog');
  await expect(d).toContainText('손잡이 1개');              // 시뮬레이션이 들어 있는지 보여준다
  await expect(d).toContainText('지금은 예시 공간이에요');    // 그리고 저장되지 않는다고 말한다
  await expect(d.getByRole('button', {name: '이 기록으로 교체'})).toHaveCount(0);
  await d.getByRole('button', {name: '내 공간으로 바꾸기'}).click();
  await expect(page.getByRole('status')).toContainText('내 공간으로 바꿨어요');
});

test('모바일 하단 탭으로 모든 화면에 갈 수 있다', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile', '모바일 전용');
  await page.goto('./');
  await page.getByRole('button', {name: '로그인 없이 둘러보기'}).click();
  const tabs = page.locator('.mobile-nav>button');
  await expect(tabs).toHaveCount(2);
  for (const [label, heading] of [['시뮬레이션', /앞으로 \d+달/], ['일기', /^일기$/]] as const) {
    await page.locator('.mobile-nav').getByRole('button', {name: label}).click();
    await expect(page.getByRole('heading', {name: heading})).toBeVisible();
  }
  const over = await page.evaluate(() => {
    const n = document.querySelector('.mobile-nav')!;
    return n.scrollWidth > n.clientWidth + 1;
  });
  expect(over, '하단 탭이 가로로 넘친다').toBe(false);
});

// 가로 넘침은 모바일에서 조용히 치명적이다: 브라우저가 페이지를 축소하고
// **고정 하단 탭이 화면 밖으로 밀려 안 눌린다.** 기록 이력 표가 실제로 그랬다.
test('모바일 어느 화면에서도 가로로 넘치지 않는다', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile', '모바일 전용');
  await page.goto('./');
  await page.getByRole('button', {name: '로그인 없이 둘러보기'}).click();
  for (const tab of ['시뮬레이션', '일기']) {
    await page.locator('.mobile-nav').getByRole('button', {name: tab}).click();
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const d = document.documentElement;
      return {over: d.scrollWidth - d.clientWidth,
        navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect().top,
        vh: window.innerHeight};
    });
    expect(m.over, `${tab} 화면이 가로로 ${m.over}px 넘친다`).toBeLessThanOrEqual(0);
    expect(m.navTop, `${tab} 화면에서 하단 탭이 뷰포트 밖으로 밀렸다`).toBeLessThan(m.vh);
  }
});

test('desktop and mobile screenshots', async ({page}, info) => {
  await page.goto('./');
  await expect(page.getByRole('heading', {name: '다시 만나 반가워요'})).toBeVisible();
  await page.screenshot({path: `test-results/${info.project.name}-login.png`, fullPage: true});
  await page.getByRole('button', {name: '로그인 없이 둘러보기'}).click();
  await page.getByRole('heading', {name: /앞으로 \d+달/}).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({path: `test-results/${info.project.name}-sim.png`, fullPage: true});
  await go(page, '일기');
  await page.getByRole('heading', {name: '일기', exact: true}).waitFor();
  await page.screenshot({path: `test-results/${info.project.name}-journal.png`, fullPage: true});
});

// 2026-11-11 백지 사고: store 가 parseBackup 결과를 버리고 **원본 캐시를 그대로** 썼다.
// 그래서 나중에 생긴 칸(journal)이 undefined 로 남아 사이드바 첫 렌더에서 터졌고 화면이 통째로 백지가 됐다.
// 캐시가 없는 새 브라우저에서는 재현되지 않는다 — 그래서 **예전 형식 캐시를 직접 심어** 잰다.
test('예전 형식 캐시로도 앱이 열린다 — journal 이 없던 시절 데이터', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));

  // journal·sim 이 없던 때의 워크스페이스를 IndexedDB 에 심는다
  await page.addInitScript(() => {
    localStorage.setItem('life:mode', 'personal');
    localStorage.setItem('life:gate', 'local');
    const old = {
      schemaVersion: 1, name: '옛 공간', chapter: '옛 챕터',
      domains: [{id: 'finance', name: '재정 운영', color: 'sage', icon: 'wallet'}],
      quests: [], plans: [], observations: [], rewards: [], reviews: [],
      rewardBudget: null, events: [],      // journal 없음 · sim 없음
    };
    const open = indexedDB.open('keyval-store', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('keyval');
    open.onsuccess = () => {
      const tx = open.result.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put({data: old, revision: 3, dirty: false, requestId: 'x'},
        'life:workspace:guest');
    };
  });

  await page.goto('./');
  await page.waitForTimeout(1200);
  // 백지가 아니어야 한다
  const len = await page.evaluate(() => document.querySelector('#root')!.innerHTML.length);
  expect(len, '첫 렌더에서 터져 화면이 비었다').toBeGreaterThan(500);
  await expect(page.locator('.sidebar nav, .mobile-nav').getByRole('button', {name: '시뮬레이션'}).first()).toBeVisible();
  // 일기 화면도 열린다 (journal 이 undefined 여도)
  await go(page, '일기');
  await expect(page.getByRole('heading', {name: '일기', exact: true})).toBeVisible();
  await expect(page.getByLabel('오늘의 일기')).toBeVisible();
  expect(errors, '페이지 오류가 났다').toEqual([]);
});
