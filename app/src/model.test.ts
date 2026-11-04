import { describe,it,expect } from 'vitest';
import { createDemo,createEmpty,completeQuest,xpOf,level,reserveReward,rewardAvailable,assessBranch,parseBackup,nextSuggestion,accuracy,rewardProgress,pokerNet,evaluateTriggers,ruleText,weekStats, statOf, combatPower, powerDiff, questQueue, focusQuest, subQuestFor, acceptSubQuest, type Quest, type Workspace, isSubQuest, OBS_GROUPS, OBS_NAME, OBS_UNIT, checkObservation, obsText } from './model';
describe('actual execution and rewards',()=>{
 it('undo returns XP without changing observed cash',()=>{const s=createDemo(),xp=xpOf(s),done=completeQuest(s,'q1');expect(xpOf(done)).toBe(xp+15);const undone=completeQuest(done,'q1');expect(xpOf(undone)).toBe(xp);expect(undone.observations).toEqual(s.observations);});
 it('reserving a reward uses budget only once and requires evidence',()=>{let s=createDemo();s.rewards[1].requiredXp=0;const reserved=reserveReward(s,'r2');expect(rewardAvailable(reserved)).toBe(35000);expect(()=>reserveReward(reserved,'r2')).toThrow();expect(reserved.observations).toEqual(s.observations);});
 it('missing budget is not zero and blocks paid rewards',()=>{const s=createDemo();s.rewardBudget=null;s.rewards[1].requiredXp=0;expect(rewardAvailable(s)).toBeNull();expect(()=>reserveReward(s,'r2')).toThrow();expect(reserveReward(s,'r3').rewards.find(r=>r.id==='r3')?.status).toBe('reserved');});
 it('experience levels honor boundaries',()=>{expect(level(99).level).toBe(1);expect(level(100).level).toBe(2);expect(level(299).remaining).toBe(1);expect(level(300).level).toBe(3);});
});
describe('plans and inputs',()=>{
 it('unknown resources cannot pass and time can independently block',()=>{const s=createDemo(),p=s.plans[0];s.observations=[];expect(assessBranch(s,p,'A').state).toBe('unknown');s.observations=[{id:'a',kind:'cash',date:'2026-01-01',value:1000,note:''},{id:'b',kind:'hours',date:'2026-01-01',value:0.1,note:''}];expect(assessBranch(s,p,'A').state).toBe('blocked');});
 it('switch costs belong to alternative routes only',()=>{const s=createDemo(),p=s.plans[0];p.branches[0].switchCost=100;p.branches[1].switchCost=200;expect(assessBranch(s,p,'A').cost).toBe(0);expect(assessBranch(s,p,'B').cost).toBe(200);});
 it('corrupt backup and duplicate/dangling identifiers are rejected',()=>{const s=createDemo();expect(()=>parseBackup({...s,schemaVersion:2})).toThrow();expect(()=>parseBackup({...s,quests:[s.quests[0],s.quests[0]]})).toThrow();expect(()=>parseBackup({...s,quests:[{...s.quests[0],domainId:'missing'}]})).toThrow();expect(()=>parseBackup({...s,observations:[{id:'x',kind:'cash',date:'bad',value:-100,note:''}]})).toThrow();expect(parseBackup(createEmpty()).observations).toEqual([]);});
});

describe('결과 등급이 성장과 다음 제안에 반영된다',()=>{
 const base=()=>{
  const s=createEmpty();
  s.plans=[{id:'p',title:'지출 줄이기',goal:'월 100만',domainId:'finance',active:'A',branches:[
   {key:'A',title:'배분대로',cost:0,hours:2,duration:90,result:'',trigger:'',rule:null,switchCost:0},
   {key:'B',title:'고정비 먼저',cost:0,hours:3,duration:90,result:'',trigger:'',rule:null,switchCost:0},
   {key:'C',title:'기록만',cost:0,hours:.5,duration:90,result:'',trigger:'',rule:null,switchCost:0}]}];
  s.quests=[1,2,3].map(i=>({id:`q${i}`,title:`퀘스트 ${i}`,domainId:'finance',minutes:10,xp:20,
   due:'2026-11-02',status:'ready' as const,criterion:'',partialCriterion:'',minimumCriterion:'',planId:'p',repeat:'none' as const,completedAt:null,outcome:null}));
  return s;
 };
 it('끝까지 / 절반 / 못 함이 서로 다른 XP 를 남긴다',()=>{
  let s=base();
  s=completeQuest(s,'q1','full');      expect(xpOf(s)).toBe(20);
  s=completeQuest(s,'q2','partial');   expect(xpOf(s)).toBe(30);   // +10
  s=completeQuest(s,'q3','missed');    expect(xpOf(s)).toBe(32);   // +2 — 0 이 아니다
 });
 it('완료를 취소하면 결과도 지워진다',()=>{
  let s=completeQuest(base(),'q1','partial');
  expect(s.quests.find(q=>q.id==='q1')!.outcome).toBe('partial');
  s=completeQuest(s,'q1');
  expect(s.quests.find(q=>q.id==='q1')!.outcome).toBeNull();
  expect(xpOf(s)).toBe(0);
 });
 it('한 번 못 했다고 경로를 흔들지 않는다',()=>{
  const s=completeQuest(base(),'q1','missed');
  expect(nextSuggestion(s,'q1')?.switchTo).toBeUndefined();
 });
 it('최근 결과가 두 번 이상 약하면 더 가벼운 경로를 권한다',()=>{
  let s=completeQuest(base(),'q1','missed');
  s=completeQuest(s,'q2','partial');
  const sug=nextSuggestion(s,'q2');
  expect(sug?.switchTo).toBe('B');
  expect(sug?.planId).toBe('p');
 });
 it('세 번 끝까지 해내면 더 높은 경로를 권한다',()=>{
  let s=base(); s.plans=[{...s.plans[0],active:'C'}];
  s=completeQuest(s,'q1','full'); s=completeQuest(s,'q2','full'); s=completeQuest(s,'q3','full');
  expect(nextSuggestion(s,'q3')?.switchTo).toBe('A');
 });
});

describe('보상 상세와 분야별 완주율',()=>{
 const seed=()=>{
  const s=createEmpty();
  s.rewardBudget=50000;
  s.quests=[
   {id:'a1',title:'재정 1',domainId:'finance',minutes:5,xp:40,due:'2026-11-01',status:'done',criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',repeat:'none' as const,completedAt:'2026-11-01T00:00:00Z',outcome:'full'},
   {id:'a2',title:'재정 2',domainId:'finance',minutes:5,xp:40,due:'2026-11-01',status:'done',criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',repeat:'none' as const,completedAt:'2026-11-01T01:00:00Z',outcome:'partial'},
   {id:'b1',title:'회복 1',domainId:'recovery',minutes:5,xp:40,due:'2026-11-01',status:'done',criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',repeat:'none' as const,completedAt:'2026-11-01T02:00:00Z',outcome:'full'},
  ];
  return s;
 };
 it('완주율은 분야마다 따로 센다',()=>{
  const s=seed();
  expect(accuracy(s,'finance')?.ratio).toBe(0.5);   // 2건 중 1건만 full
  expect(accuracy(s,'recovery')?.ratio).toBe(1);
  expect(accuracy(s,'learning')).toBeNull();        // 기록이 없으면 비율을 지어내지 않는다
  expect(accuracy(s)?.done).toBe(3);
 });
 it('분야가 지정된 보상은 그 분야 성장으로만 열린다',()=>{
  const s=seed();                                    // finance 60 XP(40+20), recovery 40 XP
  s.rewards=[{id:'r',title:'회복 보상',type:'real',cost:0,requiredXp:50,domainId:'recovery',note:'',status:'wish',spent:null,usedAt:null,reservedAt:null}];
  const pg=rewardProgress(s,s.rewards[0]);
  expect(pg.xp).toBe(40);
  expect(pg.unlocked).toBe(false);                   // 전체 XP 는 100 이지만 recovery 는 40
  expect(pg.scope).toBe('회복 습관');
  expect(()=>reserveReward(s,'r')).toThrow();
 });
 it('예약하면 시각이 남는다',()=>{
  const s=seed();
  s.rewards=[{id:'r',title:'무료 보상',type:'real',cost:0,requiredXp:0,domainId:'',note:'',status:'wish',spent:null,usedAt:null,reservedAt:null}];
  const after=reserveReward(s,'r').rewards[0];
  expect(after.status).toBe('reserved');
  expect(after.reservedAt).not.toBeNull();
 });
 it('포커 순유출은 나간 돈에서 돌아온 돈을 뺀다',()=>{
  const s=seed();
  s.observations=[
   {id:'p1',kind:'poker-out',value:2_600_000,date:'2026-10-31',note:''},
   {id:'p2',kind:'poker-in',value:1_674_593,date:'2026-10-31',note:''}];
  expect(pokerNet(s)?.net).toBe(925_407);
  expect(pokerNet(createEmpty())).toBeNull();        // 기록이 없으면 0 이 아니라 null
 });
});

describe('전환 조건을 기계가 판정한다',()=>{
 const planWith=(rules:Partial<Record<'A'|'B'|'C',unknown>>,active:'A'|'B'|'C'='A')=>{
  const s=createEmpty();
  s.plans=[{id:'p',title:'지출',goal:'목표',domainId:'finance',active,branches:(['A','B','C'] as const).map(k=>
   ({key:k,title:`${k} 경로`,cost:0,hours:1,duration:30,result:'r',trigger:'',rule:(rules[k]??null) as never,switchCost:0}))}];
  return s;
 };
 const q=(id:string,outcome:'full'|'partial'|'missed',at:string)=>
  ({id,title:id,domainId:'finance',minutes:5,xp:20,due:'2026-11-01',status:'done' as const,
    criterion:'',partialCriterion:'',minimumCriterion:'',planId:'p',repeat:'none' as const,completedAt:at,outcome});

 it('조건이 맞지 않으면 아무 신호도 내지 않는다',()=>{
  const s=planWith({A:{when:'outcomes',recent:3,weak:2,to:'B'}});
  s.quests=[q('a','full','2026-11-01T00:00:00Z'),q('b','full','2026-11-01T01:00:00Z'),q('c','full','2026-11-01T02:00:00Z')];
  expect(evaluateTriggers(s,s.plans[0])).toEqual([]);
 });
 it('최근 결과가 약하면 발동한다',()=>{
  const s=planWith({A:{when:'outcomes',recent:3,weak:2,to:'B'}});
  s.quests=[q('a','missed','2026-11-01T00:00:00Z'),q('b','partial','2026-11-01T01:00:00Z'),q('c','full','2026-11-01T02:00:00Z')];
  const fired=evaluateTriggers(s,s.plans[0]);
  expect(fired).toHaveLength(1);
  expect(fired[0].to).toBe('B');
 });
 it('표본이 모자라면 발동하지 않는다',()=>{
  const s=planWith({A:{when:'outcomes',recent:3,weak:2,to:'B'}});
  s.quests=[q('a','missed','2026-11-01T00:00:00Z'),q('b','missed','2026-11-01T01:00:00Z')];
  expect(evaluateTriggers(s,s.plans[0])).toEqual([]);   // 2건뿐이라 아직 모른다
 });
 it('연속 완주는 올라가는 신호를 낸다',()=>{
  const s=planWith({C:{when:'streak',full:3,to:'A'}},'C');
  s.quests=[q('a','full','2026-11-01T00:00:00Z'),q('b','full','2026-11-01T01:00:00Z'),q('c','full','2026-11-01T02:00:00Z')];
  expect(evaluateTriggers(s,s.plans[0])[0]?.to).toBe('A');
 });
 it('지금 경로로 가라는 조건은 신호가 아니다',()=>{
  const s=planWith({A:{when:'streak',full:1,to:'A'}},'A');
  s.quests=[q('a','full','2026-11-01T00:00:00Z')];
  expect(evaluateTriggers(s,s.plans[0])).toEqual([]);
 });
 it('기록한 값이 기준을 밑돌면 발동한다',()=>{
  const s=planWith({A:{when:'observation',kind:'hours',op:'lt',value:2,to:'C'}});
  s.observations=[{id:'o',kind:'hours',value:1,date:'2026-11-01',note:''}];
  const f=evaluateTriggers(s,s.plans[0]);
  expect(f[0]?.to).toBe('C');
  expect(f[0]?.reason).toContain('주간 가용시간');
 });
 it('ruleText 는 사람이 읽을 수 있다',()=>{
  expect(ruleText({when:'idle',days:14,to:'B'})).toContain('14일');
  expect(ruleText({when:'observation',kind:'cash',op:'lt',value:3000000,to:'C'})).toContain('가용 현금');
 });
});

describe('주간 회고 요약',()=>{
 it('지난 7일만 센다',()=>{
  const s=createEmpty();
  const mk=(id:string,outcome:'full'|'partial',daysAgo:number)=>({id,title:id,domainId:'finance',minutes:5,xp:20,
   due:'2026-11-01',status:'done' as const,criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',repeat:'none' as const,
   completedAt:new Date(Date.now()-daysAgo*86400000).toISOString(),outcome});
  s.quests=[mk('a','full',1),mk('b','partial',3),mk('c','full',30)];   // 30일 전은 제외
  const w=weekStats(s);
  expect(w.done).toBe(2);
  expect(w.full).toBe(1);
  expect(w.partial).toBe(1);
  expect(w.xp).toBe(30);   // 20 + 10
 });
});

describe('조사',()=>{
 it('받침에 따라 이/가를 고른다',()=>{
  expect(ruleText({when:'observation',kind:'hours',op:'lt',value:1,to:'C'})).toContain('주간 가용시간이');
  expect(ruleText({when:'observation',kind:'poker-in',op:'gt',value:1,to:'C'})).toContain('포커 회수가');
 });
});

describe('반복 퀘스트',()=>{
 const mk=(repeat:'none'|'daily'|'weekly',due:string)=>{
  const s=createEmpty();
  s.quests=[{id:'r1',title:'매일 할 것',domainId:'learning',minutes:15,xp:10,due,status:'ready',
   criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',repeat,completedAt:null,outcome:null}];
  return s;
 };
 it('반복이 아니면 다음 회차를 만들지 않는다',()=>{
  const s=completeQuest(mk('none','2026-11-03'),'r1','full');
  expect(s.quests).toHaveLength(1);
 });
 it('매일 반복은 완료 기록을 남기고 다음 회차를 만든다',()=>{
  const s=completeQuest(mk('daily','2026-11-03'),'r1','partial');
  expect(s.quests).toHaveLength(2);
  const done=s.quests.find(q=>q.status==='done')!,next=s.quests.find(q=>q.status==='ready')!;
  expect(done.outcome).toBe('partial');          // 결과가 남는다 — 완주율을 셀 수 있다
  expect(next.outcome).toBeNull();
  expect(next.id).not.toBe(done.id);
  expect(next.due>done.due).toBe(true);
 });
 it('지난 마감이면 과거 회차를 되살리지 않고 오늘 이후로 잡는다',()=>{
  const s=completeQuest(mk('daily','2020-01-01'),'r1','full');
  const next=s.quests.find(q=>q.status==='ready')!;
  const t=new Date().toISOString().slice(0,10);
  expect(next.due>t).toBe(true);
 });
 it('매주는 7일 뒤로 간다',()=>{
  const base=new Date(Date.now()+86400000).toISOString().slice(0,10);   // 내일
  const s=completeQuest(mk('weekly',base),'r1','full');
  const next=s.quests.find(q=>q.status==='ready')!;
  const gap=(Date.parse(next.due)-Date.parse(base))/86400000;
  expect(gap).toBe(7);
 });
 it('완료를 취소해도 다음 회차가 또 생기지는 않는다',()=>{
  let s=completeQuest(mk('daily','2026-11-03'),'r1','full');
  const doneId=s.quests.find(q=>q.status==='done')!.id;
  s=completeQuest(s,doneId);
  expect(s.quests.filter(q=>q.status==='ready')).toHaveLength(2);  // 되돌린 것 + 이미 만든 다음 회차
 });
});

// ── 게임 층 ──
describe('스탯과 전투력', () => {
 const ws = (quests: Partial<Quest>[]): Workspace => ({...createEmpty(), quests: quests.map((q, i) => ({
  id: `q${i}`, title: `q${i}`, domainId: 'recovery', minutes: 10, xp: 10, due: '2026-11-03',
  status: 'done', criterion: '', partialCriterion: '', minimumCriterion: '', planId: '',
  repeat: 'none', completedAt: '2026-11-03T10:00:00Z', outcome: 'full', ...q} as Quest))});

 it('스탯은 레벨에만 의존하고 레벨업 때 정수로 점프한다', () => {
  // 레벨 1 = 10. 100 XP 에서 레벨 2 (50*l*(l+1) <= xp)
  expect(statOf(ws([]), 'recovery')).toBe(10);
  expect(statOf(ws([{xp: 50}]), 'recovery')).toBe(10);        // 아직 레벨 1
  expect(statOf(ws([{xp: 50}, {xp: 50}]), 'recovery')).toBe(20); // 100 XP → 레벨 2
 });

 it('전투력은 모든 분야 스탯의 합이다 — 분야 6개면 바닥이 60', () => {
  expect(combatPower(createEmpty())).toBe(60);
  expect(combatPower(ws([{xp: 50}, {xp: 50}]))).toBe(70);
 });

 it('powerDiff 가 올라간 스탯만 집어낸다', () => {
  const d = powerDiff(ws([{xp: 50}]), ws([{xp: 50}, {xp: 50}]));
  expect(d.from).toBe(60); expect(d.to).toBe(70);
  expect(d.ups.map(u => u.name)).toEqual(['체력']);
  expect(d.ups[0].level).toBe(2);
 });

 it('아무도 레벨업하지 않으면 ups 가 비어 있다', () => {
  expect(powerDiff(ws([{xp: 10}]), ws([{xp: 10}, {xp: 10}])).ups).toEqual([]);
 });
});

describe('한 번에 하나만 — 퀘스트 큐', () => {
 const q = (o: Partial<Quest>): Quest => ({id: o.title!, title: o.title!, domainId: 'recovery', minutes: 10,
  xp: 10, due: '2026-11-03', status: 'ready', criterion: '', partialCriterion: '', minimumCriterion: '',
  planId: '', repeat: 'none', completedAt: null, outcome: null, ...o});

 it('마감 지난·오늘 것이 먼저, 같은 날이면 짧은 것이 먼저', () => {
  const s = {...createEmpty(), quests: [
   q({title: '미래 짧은', due: '2026-12-01', minutes: 1}),
   q({title: '오늘 긴', due: '2026-11-03', minutes: 90}),
   q({title: '오늘 짧은', due: '2026-11-03', minutes: 5}),
   q({title: '지난', due: '2026-10-20', minutes: 60}),
  ]};
  expect(questQueue(s, '2026-11-03').map(x => x.title)).toEqual(['지난', '오늘 짧은', '오늘 긴', '미래 짧은']);
  expect(focusQuest(s, '2026-11-03')?.title).toBe('지난');
 });

 it('완료된 것은 큐에 없고, 빈 큐면 focusQuest 가 null 이다', () => {
  expect(focusQuest({...createEmpty(), quests: [q({title: 'a', status: 'done'})]}, '2026-11-03')).toBeNull();
 });
});

describe('서브퀘스트는 다 끝냈을 때만 열린다', () => {
 const q = (o: Partial<Quest>): Quest => ({id: o.title!, title: o.title!, domainId: 'recovery', minutes: 10,
  xp: 10, due: '2026-11-03', status: 'ready', criterion: '', partialCriterion: '', minimumCriterion: '',
  planId: '', repeat: 'none', completedAt: null, outcome: null, ...o});

 it('남은 퀘스트가 있으면 열리지 않는다', () => {
  const s = {...createEmpty(), quests: [q({title: '남음'}), q({title: '됨', status: 'done', completedAt: '2026-11-03T01:00:00Z'})]};
  expect(subQuestFor(s, '2026-11-03')).toBeNull();
 });

 it('아무것도 안 했으면 열리지 않는다 — 빈 날은 보상이 아니다', () => {
  expect(subQuestFor(createEmpty(), '2026-11-03')).toBeNull();
 });

 it('다 끝내면 열리고, 같은 날에는 같은 것이 나온다', () => {
  const s = {...createEmpty(), quests: [q({title: '됨', status: 'done', completedAt: '2026-11-03T01:00:00Z'})]};
  const a = subQuestFor(s, '2026-11-03'), b = subQuestFor(s, '2026-11-03');
  expect(a).not.toBeNull();
  expect(a).toBe(b);
 });

 it('날이 바뀌면 다른 것이 나온다', () => {
  const mk = (d: string) => ({...createEmpty(), quests: [q({title: '됨', due: d, status: 'done', completedAt: `${d}T01:00:00Z`})]});
  const seen = new Set(['2026-11-03', '2026-11-04', '2026-11-05'].map(d => subQuestFor(mk(d), d)?.title));
  expect(seen.size).toBe(3);
 });

 it('수락하면 실제 퀘스트가 되고 하루에 하나만 열린다', () => {
  const s = {...createEmpty(), quests: [q({title: '됨', status: 'done', completedAt: '2026-11-03T01:00:00Z'})]};
  const after = acceptSubQuest(s, '2026-11-03');
  const sub = after.quests.find(isSubQuest)!;
  expect(sub.title).toContain('보너스 —');
  expect(sub.status).toBe('ready');
  expect(subQuestFor(after, '2026-11-03')).toBeNull();   // 이미 받았다
  expect(() => acceptSubQuest(after, '2026-11-03')).toThrow();
 });
});

describe('보너스 수락은 저장까지 통과해야 한다', () => {
 it('수락 결과가 스키마를 통과한다 — planId 가 실제 플랜을 가리켜야 한다(조용한 실패 방지)', () => {
  const base = createEmpty();
  const s0: Workspace = {...base, quests: [{id: 'a', title: '됨', domainId: 'recovery', minutes: 10, xp: 10,
   due: '2026-11-03', status: 'done', criterion: '', partialCriterion: '', minimumCriterion: '', planId: '',
   repeat: 'none', completedAt: '2026-11-03T01:00:00Z', outcome: 'full'}]};
  expect(() => parseBackup(acceptSubQuest(s0, '2026-11-03'))).not.toThrow();
 });
});

// 2026-11-03: 기록 항목이 6개뿐이라 좁았다. 늘리면서 체중이 '(원)' 으로 표시되던 버그도 잡았다.
describe('기록 항목과 단위', () => {
 it('14개 항목이 모두 네 묶음 중 하나에 들어 있다 — 빠뜨리면 고를 수 없다', () => {
  const grouped = OBS_GROUPS.flatMap(([, ks]) => ks);
  expect(new Set(grouped).size).toBe(grouped.length);               // 중복 없음
  expect(grouped.sort()).toEqual(Object.keys(OBS_NAME).sort());     // 빠진 것 없음
 });

 it('모든 항목에 이름과 단위가 있다', () => {
  for (const k of Object.keys(OBS_NAME) as (keyof typeof OBS_NAME)[]) {
   expect(OBS_NAME[k]).toBeTruthy();
   expect(OBS_UNIT[k]).toBeTruthy();
  }
 });

 it('체중의 단위는 kg 이다 — 화면에 (원) 으로 나왔던 회귀', () => {
  expect(OBS_UNIT.weight).toBe('kg');
  expect(obsText('weight', 72)).toBe('72kg');
  expect(obsText('cash', 5000000)).toBe('5,000,000원');
  expect(obsText('steps', 8200)).toBe('8200걸음');
  expect(obsText('mood', 4)).toBe('4점');
  expect(obsText('late', 2)).toBe('2회');
 });

 it('범위를 벗어난 값은 항목 이름과 단위가 담긴 문장으로 막는다', () => {
  expect(checkObservation('sleep', 25)).toContain('24시간');
  expect(checkObservation('hours', 200)).toContain('168시간');
  expect(checkObservation('weight', 10)).toContain('20kg');
  expect(checkObservation('mood', 6)).toContain('5점');
  expect(checkObservation('sleep', 7)).toBeNull();
  expect(checkObservation('cash', 5_000_000)).toBeNull();   // 돈에는 상한을 두지 않는다
 });

 it('새 항목이 스키마를 통과한다', () => {
  const s = {...createEmpty(), observations: (['spend', 'debt', 'income', 'poker-hours', 'exercise', 'steps', 'mood', 'study'] as const)
   .map((kind, i) => ({id: `o${i}`, kind, value: 3, date: '2026-11-03', note: ''}))};
  expect(() => parseBackup(s)).not.toThrow();
 });
});
