import { describe,it,expect } from 'vitest';
import { createDemo,createEmpty,completeQuest,xpOf,level,reserveReward,rewardAvailable,assessBranch,parseBackup,nextSuggestion } from './model';
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
   due:'2026-11-02',status:'ready' as const,criterion:'',planId:'p',completedAt:null,outcome:null}));
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
