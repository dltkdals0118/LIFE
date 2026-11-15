import {describe,it,expect} from 'vitest';
import {createDemo,createEmpty,parseBackup,projectCash,defaultPicks,evaluateTriggers,today} from './model';
import {saveBaseline,adoptScenario,reviewDecision,baselineNotice} from './planning';
const input={title:'실험',goal:'공고 3개 검토',reviewDate:today(),action:'공고 모으기',criterion:'표 하나',minutes:30,assumptions:'주당 시간을 확보한다'};
describe('계획의 실행과 검토',()=>{
 it('이전 백업에 결정 배열이 없어도 복원한다',()=>{const {decisions,...old}=createEmpty();expect(parseBackup(old).decisions).toEqual([]);});
 it('미래 효과는 시작월 전 시간에 적용하지 않는다',()=>{
  const sim=createDemo().sim!;sim.startMonth='2030-01';sim.months=3;sim.baseFreeHours=1;
  sim.levers=[{id:'x',name:'시간 사용',starts:'2030-03',basis:'',group:'',options:[{key:'A',label:'실행',delta:0,hours:-2,requires:[]}]}];
  const r=projectCash(sim,{x:'A'});expect(r.timeRows.map(x=>x.freeHours)).toEqual([1,1,-1]);expect(r.timeBlocked).toBe(true);
 });
 it('빈 새 공간에서 입력한 기준값으로 계산하고 미확인 시간을 유지한다',()=>{
  const sim={...createDemo().sim!,asOf:'2026-01-31',startMonth:'2026-02',cash:100000,netMonthly:-20000,months:2,levers:[],baseFreeHours:null};
  const s=saveBaseline(createEmpty(),sim);expect(projectCash(s.sim!,{}).endCash).toBe(60000);expect(projectCash(s.sim!,{}).freeHours).toBeNull();
  expect(()=>adoptScenario(s,input)).toThrow('가용시간');
  expect(()=>saveBaseline(s,{...sim,startMonth:'2026-01'})).toThrow();
 });
 it('채택은 관측을 바꾸지 않고 입력과 선택의 사본 및 행동을 보존한다',()=>{
  const s=createDemo(),before=structuredClone(s.observations);const a=parseBackup(adoptScenario(s,input));
  expect(a.observations).toEqual(before);expect(a.decisions).toHaveLength(1);expect(a.quests.some(q=>q.id===a.decisions[0].actionId)).toBe(true);
  const cash=a.decisions[0].sim.cash;s.sim!.cash=9;expect(a.decisions[0].sim.cash).toBe(cash);
  expect(()=>adoptScenario(a,input)).toThrow('진행 중');
 });
 it('음수 시간 조합은 채택할 수 없다',()=>{const s=createDemo();s.sim!.baseFreeHours=-1;expect(()=>adoptScenario(s,input)).toThrow('시간이 부족');});
 it('결과 비교는 같은 종료 월의 예상과 실제를 남긴다',()=>{
  const s=createDemo();s.sim={...s.sim!,asOf:'2020-01-31',startMonth:'2020-02',months:2};
  const a=adoptScenario(s,input);const id=a.decisions[0].id;
  const r={at:today(),actualCash:2000000,actualMonth:'2020-02',obstacle:'time' as const,note:'시간 부족',next:'분량 축소'};
  expect(()=>reviewDecision(a,id,{...r,actualMonth:today().slice(0,7)})).toThrow();
  expect(()=>reviewDecision(a,id,{...r,actualMonth:'2019-01'})).toThrow();
  const reviewed=parseBackup(reviewDecision(a,id,r));expect(reviewed.decisions[0].status).toBe('reviewed');expect(reviewed.decisions[0].sim).toEqual(a.decisions[0].sim);
 });
 it('새 실제 기록은 기준점 자동 변경 대신 갱신 안내를 만든다',()=>{const s=createDemo();s.sim!.asOf='2020-01-31';s.observations=[{id:'x',kind:'cash',value:10,date:today(),note:''}];expect(baselineNotice(s)).toContain('새로워요');expect(s.sim!.cash).not.toBe(10);});
 it('완료가 없는 신규 플랜은 즉시 idle 신호를 내지 않는다',()=>{const s=createDemo();s.quests=[];expect(evaluateTriggers(s,s.plans[0])).toEqual([]);});
});
