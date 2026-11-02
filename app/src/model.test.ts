import { describe,it,expect } from 'vitest';
import { createDemo,createEmpty,completeQuest,xpOf,level,reserveReward,rewardAvailable,assessBranch,parseBackup,nextSuggestion,accuracy,rewardProgress,pokerNet,evaluateTriggers,ruleText,weekStats } from './model';
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
