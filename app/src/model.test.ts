import { describe,it,expect } from 'vitest';
import { createDemo,createEmpty,completeQuest,xpOf,level,reserveReward,rewardAvailable,assessBranch,parseBackup,nextSuggestion,accuracy,rewardProgress,pokerNet } from './model';
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
   {key:'A',title:'배분대로',cost:0,hours:2,duration:90,result:'',trigger:'',switchCost:0},
   {key:'B',title:'고정비 먼저',cost:0,hours:3,duration:90,result:'',trigger:'',switchCost:0},
   {key:'C',title:'기록만',cost:0,hours:.5,duration:90,result:'',trigger:'',switchCost:0}]}];
  s.quests=[1,2,3].map(i=>({id:`q${i}`,title:`퀘스트 ${i}`,domainId:'finance',minutes:10,xp:20,
   due:'2026-11-02',status:'ready' as const,criterion:'',partialCriterion:'',minimumCriterion:'',planId:'p',completedAt:null,outcome:null}));
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
   {id:'a1',title:'재정 1',domainId:'finance',minutes:5,xp:40,due:'2026-11-01',status:'done',criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',completedAt:'2026-11-01T00:00:00Z',outcome:'full'},
   {id:'a2',title:'재정 2',domainId:'finance',minutes:5,xp:40,due:'2026-11-01',status:'done',criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',completedAt:'2026-11-01T01:00:00Z',outcome:'partial'},
   {id:'b1',title:'회복 1',domainId:'recovery',minutes:5,xp:40,due:'2026-11-01',status:'done',criterion:'',partialCriterion:'',minimumCriterion:'',planId:'',completedAt:'2026-11-01T02:00:00Z',outcome:'full'},
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
