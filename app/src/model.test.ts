import { describe,it,expect } from 'vitest';
import { createDemo,createEmpty,completeQuest,xpOf,level,reserveReward,rewardAvailable,assessBranch,parseBackup } from './model';
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
