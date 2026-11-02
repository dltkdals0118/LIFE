import { z } from 'zod';

const id = z.string().min(1).max(150);
const label = z.string().trim().min(1).max(200);
const amount = z.number().finite().min(0).max(1e12);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;},'유효한 날짜를 입력해 주세요.');
export const domainSchema = z.object({id, name:label, color:z.enum(['sage','blue','amber','rose','violet','teal']), icon:z.enum(['wallet','sprout','briefcase','book','heart','sparkles'])});
export const questSchema = z.object({id,title:label,domainId:id,minutes:amount.max(10000),xp:amount.max(50),due:date,status:z.enum(['ready','done','paused']),criterion:z.string().max(2000),partialCriterion:z.string().max(2000).default(''),minimumCriterion:z.string().max(2000).default(''),planId:z.string().max(150),repeat:z.enum(['none','daily','weekly']).default('none'),completedAt:z.string().nullable(),outcome:z.enum(['full','partial','missed']).nullable().default(null)});
// 전환 조건. `trigger` 는 사람이 읽는 글이고, `rule` 이 있으면 기계도 같이 읽는다.
// 규칙이 없어도 플랜은 그대로 동작한다 — 글만 있는 조건을 억지로 숫자로 바꾸지 않는다.
export const triggerRule = z.discriminatedUnion('when',[
 // 최근 N건의 결과 중 '끝까지'가 아닌 것이 M건 이상이면
 z.object({when:z.literal('outcomes'),recent:z.number().int().min(1).max(30),weak:z.number().int().min(1).max(30),to:z.enum(['A','B','C'])}),
 // 기록한 값이 기준을 밑돌거나 넘으면
 z.object({when:z.literal('observation'),kind:z.enum(['cash','hours','sleep','poker-out','poker-in']),op:z.enum(['lt','gt']),value:amount,to:z.enum(['A','B','C'])}),
 // 이 플랜에서 N일 동안 완료가 없으면
 z.object({when:z.literal('idle'),days:z.number().int().min(1).max(365),to:z.enum(['A','B','C'])}),
 // N건을 연달아 끝까지 해내면 (올라가는 쪽)
 z.object({when:z.literal('streak'),full:z.number().int().min(1).max(30),to:z.enum(['A','B','C'])}),
]);
export type TriggerRule=z.infer<typeof triggerRule>;
export const planSchema = z.object({id,title:label,goal:label,domainId:id,active:z.enum(['A','B','C']),branches:z.array(z.object({key:z.enum(['A','B','C']),title:label,cost:amount,hours:amount.max(10000),duration:z.number().int().min(1).max(3650),result:label,trigger:z.string().max(2000),rule:triggerRule.nullable().default(null),switchCost:amount})).length(3)});
export const observationSchema = z.object({id,kind:z.enum(['cash','hours','sleep','poker-out','poker-in']),value:amount,date,note:z.string().max(2000)});
export const rewardSchema = z.object({id,title:label,type:z.enum(['digital','real']),cost:amount,requiredXp:amount.max(1e7),domainId:z.string().max(150).default(''),note:z.string().max(1000).default(''),status:z.enum(['wish','reserved','used']),spent:amount.nullable(),usedAt:z.string().nullable(),reservedAt:z.string().nullable().default(null)}).refine(r=>r.type!=='digital'||r.cost===0,'성장 배지는 비용을 0원으로 입력해 주세요.');
export const reviewSchema = z.object({id,date,win:z.string().max(4000),obstacle:z.string().max(4000),next:z.string().max(4000),stats:z.object({done:z.number().int(),full:z.number().int(),partial:z.number().int(),missed:z.number().int(),xp:z.number()}).nullable().default(null)});
export const workspaceSchema = z.object({schemaVersion:z.literal(1),name:label,chapter:label,domains:z.array(domainSchema).min(1).max(30),quests:z.array(questSchema).max(20000),plans:z.array(planSchema).max(500),observations:z.array(observationSchema).max(30000),rewards:z.array(rewardSchema).max(1000),reviews:z.array(reviewSchema).max(2000),rewardBudget:amount.nullable(),events:z.array(z.object({id,at:z.string(),text:z.string().max(1000)})).max(20000)}).superRefine((s,ctx)=>{
 for(const key of ['domains','quests','plans','observations','rewards','reviews','events'] as const) if(new Set(s[key].map(x=>x.id)).size!==s[key].length)ctx.addIssue({code:'custom',message:`${key}: 중복 ID`});
 const domains=new Set(s.domains.map(x=>x.id)),plans=new Set(s.plans.map(x=>x.id));
 for(const q of s.quests)if(!domains.has(q.domainId)||(q.planId&&!plans.has(q.planId)))ctx.addIssue({code:'custom',message:'퀘스트 연결이 올바르지 않습니다.'});
 for(const p of s.plans)if(!domains.has(p.domainId)||new Set(p.branches.map(x=>x.key)).size!==3)ctx.addIssue({code:'custom',message:'플랜의 분야 또는 ABC 구성이 올바르지 않습니다.'});
});
export type Workspace=z.infer<typeof workspaceSchema>;
export type Quest=z.infer<typeof questSchema>;
export type Plan=z.infer<typeof planSchema>;
export type Observation=z.infer<typeof observationSchema>;
export type Reward=z.infer<typeof rewardSchema>;
export const uid=()=>crypto.randomUUID();
export function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export const won=(n:number)=>new Intl.NumberFormat('ko-KR').format(n)+'원';
// 결과는 이분법이 아니다. 끝까지 간 것과 절반까지 간 것과 못 한 것이 성장에 다르게 남는다.
// 못 했어도 0 이 아니다 — 시도하고 기록한 것 자체가 다음 판단의 근거가 된다.
export const OUTCOME={full:{ratio:1,label:'끝까지 했어요'},partial:{ratio:0.5,label:'절반쯤 했어요'},missed:{ratio:0.1,label:'못 했어요'}} as const;
export type Outcome=keyof typeof OUTCOME;
export const outcomeRatio=(o:Quest['outcome'])=>o?OUTCOME[o].ratio:1; // 과거 기록(outcome 없음)은 1 로 읽는다
export const questXp=(q:Quest)=>Math.round(q.xp*outcomeRatio(q.outcome));
export const xpOf=(s:Workspace,domainId?:string)=>s.quests.filter(q=>q.status==='done'&&(!domainId||q.domainId===domainId)).reduce((n,q)=>n+questXp(q),0);
/** 완주율 — 완료한 것 중 '끝까지' 비율. 결과를 적은 것만 센다. */
export function accuracy(s:Workspace,domainId?:string){
 const done=s.quests.filter(q=>q.status==='done'&&q.outcome&&(!domainId||q.domainId===domainId));
 if(!done.length)return null;
 const full=done.filter(q=>q.outcome==='full').length;
 return {done:done.length,full,partial:done.filter(q=>q.outcome==='partial').length,
         missed:done.filter(q=>q.outcome==='missed').length,ratio:full/done.length};
}
/** 보상 잠금 해제까지. 분야가 지정된 보상은 그 분야 성장으로만 열린다. */
export function rewardProgress(s:Workspace,r:Reward){
 const xp=xpOf(s,r.domainId||undefined);
 return {xp,required:r.requiredXp,remaining:Math.max(0,r.requiredXp-xp),
         ratio:r.requiredXp?Math.min(1,xp/r.requiredXp):1,unlocked:xp>=r.requiredXp,
         scope:r.domainId?s.domains.find(d=>d.id===r.domainId)?.name??'알 수 없는 분야':'전체 성장'};
}
/** 그 주의 결과 분포. 회고에 함께 저장해 둔다 — 나중에 퀘스트가 바뀌어도 그때의 기록은 남는다. */
export function weekStats(s:Workspace,endDate=today()){
 const end=Date.parse(endDate+'T23:59:59.999Z'),start=end-7*86400000+1;
 const done=s.quests.filter(q=>q.status==='done'&&q.completedAt&&(()=>{const t=Date.parse(q.completedAt!);return t>=start&&t<=end;})());
 return {done:done.length,
   full:done.filter(q=>q.outcome==='full').length,
   partial:done.filter(q=>q.outcome==='partial').length,
   missed:done.filter(q=>q.outcome==='missed').length,
   xp:done.reduce((n,q)=>n+questXp(q),0)};
}
export function level(xp:number){let l=1;while(50*l*(l+1)<=xp)l++;const floor=50*(l-1)*l,ceil=50*l*(l+1);return {level:l,progress:(xp-floor)/(ceil-floor),next:ceil,remaining:ceil-xp};}
/** 포커 통장 순유출 — 나간 돈 − 돌아온 돈. 게임 손익이 아니라 통장에서 오간 돈이다. */
export function pokerNet(s:Workspace,fromDate?:string){
 const pick=(k:Observation['kind'])=>s.observations.filter(o=>o.kind===k&&(!fromDate||o.date>=fromDate));
 const out=pick('poker-out'),back=pick('poker-in');
 if(!out.length&&!back.length)return null;
 const sum=(a:Observation[])=>a.reduce((n,o)=>n+o.value,0);
 return {out:sum(out),in:sum(back),net:sum(out)-sum(back),count:out.length+back.length,
         latest:[...out,...back].sort((a,b)=>b.date.localeCompare(a.date))[0]?.date??null};
}
export function latest(s:Workspace,kind:Observation['kind']){return s.observations.filter(o=>o.kind===kind).sort((a,b)=>b.date.localeCompare(a.date))[0]??null;}
export function log(s:Workspace,text:string){return {...s,events:[{id:uid(),at:new Date().toISOString(),text},...s.events].slice(0,20000)};}
/** 반복 퀘스트의 다음 회차 마감일. 지난 마감이면 오늘 기준으로 당겨 잡는다 — 과거에 쌓인 회차를 되살리지 않는다. */
function nextDue(due:string,repeat:'daily'|'weekly'){
 const step=repeat==='daily'?1:7;
 const t=today();
 let d=new Date(due+'T00:00:00Z');
 do{d=new Date(d.getTime()+step*86400000);}while(d.toISOString().slice(0,10)<=t);
 return d.toISOString().slice(0,10);
}

export function completeQuest(s:Workspace,id:string,outcome:Outcome='full'){
 const q=s.quests.find(x=>x.id===id);if(!q)return s;
 const done=q.status!=='done';
 const next={...q,status:(done?'done':'ready') as Quest['status'],completedAt:done?new Date().toISOString():null,outcome:done?outcome:null};
 const gained=done?questXp(next):0;
 let quests=s.quests.map(x=>x.id===id?next:x);
 // 반복이면 다음 회차를 만든다. 완료 기록은 그대로 남고 새 회차가 따로 생긴다 —
 // 그래야 '몇 번 중 몇 번을 끝까지 했나'를 셀 수 있다.
 if(done&&q.repeat!=='none'){
  quests=[...quests,{...q,id:uid(),status:'ready',outcome:null,completedAt:null,due:nextDue(q.due,q.repeat)}];
 }
 return log({...s,quests},
   done?`${q.title} · ${OUTCOME[outcome].label} (+${gained} XP)${q.repeat!=='none'?' · 다음 회차 생성':''}`:`${q.title} · 완료 취소`);
}

/** 결과를 보고 다음 한 걸음을 권한다. 판정이 아니라 제안이고, 고르는 것은 본인이다. */
export function nextSuggestion(s:Workspace,id:string):{text:string;switchTo?:Plan['active'];planId?:string}|null{
 const q=s.quests.find(x=>x.id===id);
 if(!q||q.status!=='done'||!q.outcome)return null;
 const plan=q.planId?s.plans.find(p=>p.id===q.planId):undefined;
 // 같은 플랜에서 최근 결과 셋을 본다 — 한 번의 실패로 경로를 흔들지 않는다.
 if(plan){
  const recent=s.quests.filter(x=>x.planId===plan.id&&x.status==='done'&&x.outcome)
    .sort((a,b)=>(b.completedAt??'').localeCompare(a.completedAt??'')).slice(0,3);
  const weak=recent.filter(x=>x.outcome!=='full').length;
  if(recent.length>=2&&weak>=2&&plan.active!=='C'){
   const to=(plan.active==='A'?'B':'C') as Plan['active'];
   const name=plan.branches.find(b=>b.key===to)?.title??to;
   return {text:`최근 ${recent.length}번 중 ${weak}번이 끝까지 가지 못했어요. ${plan.title} 을 ${to} 경로(${name})로 바꾸면 더 가벼워집니다.`,switchTo:to,planId:plan.id};
  }
  if(recent.length>=3&&weak===0&&plan.active!=='A'){
   const name=plan.branches.find(b=>b.key==='A')?.title??'A';
   return {text:`최근 3번을 끝까지 해냈어요. ${plan.title} 을 A 경로(${name})로 올려볼 만합니다.`,switchTo:'A',planId:plan.id};
  }
 }
 if(q.outcome==='partial')return {text:'절반까지 왔어요. 다음엔 완료 기준을 더 작게 잡으면 끝까지 갈 수 있어요.'};
 if(q.outcome==='missed')return {text:'오늘은 어려웠네요. 기준을 낮춰 다시 세우거나, 하루 미뤄도 괜찮아요.'};
 return null;
}
export function rewardAvailable(s:Workspace){if(s.rewardBudget===null)return null;return s.rewardBudget-s.rewards.reduce((n,r)=>n+(r.status==='reserved'?r.cost:r.status==='used'?(r.spent??r.cost):0),0);}
export function reserveReward(s:Workspace,id:string){const r=s.rewards.find(x=>x.id===id);if(!r||r.status!=='wish')throw Error('예약 가능한 보상이 아닙니다.');if(xpOf(s,r.domainId||undefined)<r.requiredXp)throw Error('잠금 해제 조건을 먼저 달성해 주세요.');const available=rewardAvailable(s);if(r.type==='real'&&r.cost>0&&(available===null||available<r.cost))throw Error('보상 예산을 설정하거나 예약 금액을 조정해 주세요.');return log({...s,rewards:s.rewards.map(x=>x.id===id?{...x,status:r.type==='digital'?'used':'reserved',usedAt:r.type==='digital'?new Date().toISOString():null,reservedAt:new Date().toISOString()}:x)},`${r.title} · ${r.type==='digital'?'획득':'예약'}`);}
/** 전환 조건을 지금 상태로 판정한다. 발동한 것만 돌려준다 — 판정이지 실행이 아니다. */
export function evaluateTriggers(s:Workspace,p:Plan){
 const out:{key:Plan['active'];to:Plan['active'];reason:string}[]=[];
 const done=s.quests.filter(q=>q.planId===p.id&&q.status==='done'&&q.outcome)
   .sort((a,b)=>(b.completedAt??'').localeCompare(a.completedAt??''));
 for(const b of p.branches){
  const r=b.rule;
  if(!r||r.to===p.active)continue;          // 지금 경로로 가라는 조건은 신호가 아니다
  if(r.when==='outcomes'){
   const recent=done.slice(0,r.recent);
   const weak=recent.filter(q=>q.outcome!=='full').length;
   if(recent.length>=r.recent&&weak>=r.weak)
    out.push({key:b.key,to:r.to,reason:`최근 ${r.recent}번 중 ${weak}번이 끝까지 가지 못했어요`});
  }else if(r.when==='streak'){
   const run=done.findIndex(q=>q.outcome!=='full');
   const streak=run===-1?done.length:run;
   if(streak>=r.full)out.push({key:b.key,to:r.to,reason:`${streak}번을 연달아 끝까지 해냈어요`});
  }else if(r.when==='idle'){
   const last=done[0]?.completedAt;
   const days=last?Math.floor((Date.now()-Date.parse(last))/86400000):null;
   if(days===null||days>=r.days)
    out.push({key:b.key,to:r.to,reason:last?`${days}일 동안 완료가 없었어요`:'아직 완료한 퀘스트가 없어요'});
  }else{
   const o=latest(s,r.kind);
   if(o&&((r.op==='lt'&&o.value<r.value)||(r.op==='gt'&&o.value>r.value)))
    out.push({key:b.key,to:r.to,reason:`${OBS_NAME[r.kind]} ${o.value.toLocaleString('ko-KR')}${OBS_UNIT[r.kind]}은 기준 ${r.value.toLocaleString('ko-KR')}${OBS_UNIT[r.kind]} ${r.op==='lt'?'아래':'위'}예요`});
  }
 }
 return out;
}
export const OBS_NAME={cash:'가용 현금',hours:'주간 가용시간',sleep:'수면 시간','poker-out':'포커 송금','poker-in':'포커 회수'} as const;
export const OBS_UNIT={cash:'원',hours:'시간',sleep:'시간','poker-out':'원','poker-in':'원'} as const;
/** 조건을 사람 말로. 폼에서 만든 규칙을 카드에 그대로 보여 주기 위해서다. */
/** 받침에 따라 조사를 고른다. '주간 가용시간가' 같은 말이 나오지 않게. */
const josa=(word:string,withBatchim:string,without:string)=>{
 const c=word.charCodeAt(word.length-1);
 if(c<0xac00||c>0xd7a3)return without;          // 한글이 아니면 기본형
 return (c-0xac00)%28?withBatchim:without;
};
export function ruleText(r:TriggerRule){
 if(r.when==='outcomes')return `최근 ${r.recent}번 중 ${r.weak}번이 끝까지 못 가면 → ${r.to}`;
 if(r.when==='streak')return `${r.full}번 연달아 끝까지 하면 → ${r.to}`;
 if(r.when==='idle')return `${r.days}일 동안 완료가 없으면 → ${r.to}`;
 const n=OBS_NAME[r.kind];
 return `${n}${josa(n,'이','가')} ${r.value.toLocaleString('ko-KR')}${OBS_UNIT[r.kind]} ${r.op==='lt'?'아래로 내려가면':'위로 올라가면'} → ${r.to}`;
}
export function assessBranch(s:Workspace,p:Plan,key:Plan['active']){const b=p.branches.find(x=>x.key===key)!;const cash=latest(s,'cash'),hours=latest(s,'hours');const cost=b.cost+(key!==p.active?b.switchCost:0);const reasons:string[]=[];if(cash===null)reasons.push('현금 기록 필요');else if(cash.value<cost)reasons.push(`필요 자금 ${won(cost-cash.value)} 부족`);if(hours===null)reasons.push('주간 가용시간 기록 필요');else if(hours.value<b.hours)reasons.push(`주 ${b.hours-hours.value}시간 부족`);const unknown=cash===null||hours===null;return {cost,cash,hours,reasons,state:reasons.length?(unknown&&!reasons.some(x=>x.includes('부족'))?'unknown':'blocked'):'ready'};}
export function parseBackup(raw:unknown){return workspaceSchema.parse(raw);}
export function createEmpty():Workspace{return {schemaVersion:1,name:'나의 LIFE',chapter:'나의 속도로, 다음 한 걸음',domains:[{id:'finance',name:'재정 운영',color:'sage',icon:'wallet'},{id:'recovery',name:'회복 습관',color:'teal',icon:'sprout'},{id:'career',name:'일과 성장',color:'blue',icon:'briefcase'},{id:'learning',name:'배움',color:'amber',icon:'book'},{id:'relationships',name:'관계',color:'rose',icon:'heart'},{id:'creative',name:'창작',color:'violet',icon:'sparkles'}],quests:[],plans:[],observations:[],rewards:[],reviews:[],rewardBudget:null,events:[]};}
export function createDemo():Workspace{
 const s=createEmpty();s.name='나의 작은 우주';s.chapter='조금 더 단단한 일상 만들기';s.rewardBudget=50000;
 s.plans=[{id:'plan-1',title:'생활의 여유 만들기',goal:'이번 달 정기 지출 3개 점검하기',domainId:'finance',active:'A',branches:[{key:'A',title:'작은 것부터 차근차근',cost:0,hours:2,duration:30,result:'정기 지출 3개 확인',trigger:'2주 동안 진행이 없다면 B 검토',rule:{when:'idle',days:14,to:'B'},switchCost:0},{key:'B',title:'한 가지에 집중하기',cost:0,hours:1,duration:30,result:'가장 큰 지출 1개 확인',trigger:'주간 여유가 1시간 미만이면 C 검토',rule:{when:'observation',kind:'hours',op:'lt',value:1,to:'C'},switchCost:0},{key:'C',title:'기록만 이어가기',cost:0,hours:0.25,duration:30,result:'월말 잔액 1회 기록',trigger:'세 번 연달아 해내면 다시 올라간다',rule:{when:'streak',full:3,to:'A'},switchCost:0}]}];
 s.quests=[{id:'q1',title:'이번 달 정기결제 살펴보기',domainId:'finance',minutes:10,xp:15,due:today(),status:'ready',outcome:null,repeat:'none' as const,partialCriterion:'',minimumCriterion:'',criterion:'정기결제 목록과 다음 결제일을 기록했어요.',planId:'plan-1',completedAt:null},{id:'q2',title:'잠들기 전, 오늘의 수면 기록',domainId:'recovery',minutes:2,xp:5,due:today(),status:'ready',outcome:null,repeat:'none' as const,partialCriterion:'',minimumCriterion:'',criterion:'지난밤의 수면 시간을 기록했어요.',planId:'',completedAt:null},{id:'q3',title:'읽고 싶었던 책, 10쪽',domainId:'learning',minutes:15,xp:15,due:today(),status:'ready',outcome:null,repeat:'none' as const,partialCriterion:'',minimumCriterion:'',criterion:'10쪽을 읽고 기억할 문장 하나를 남겼어요.',planId:'',completedAt:null}];
 for(let i=0;i<18;i++){const d=new Date();d.setDate(d.getDate()-(i%7)-1);s.quests.push({id:`history-${i}`,title:['지난주 기록 정리','작은 배움 남기기','한 걸음 산책'][i%3],domainId:s.domains[i%6].id,minutes:10,xp:30,due:d.toISOString().slice(0,10),status:'done',outcome:i%5===0?'partial':'full',repeat:'none' as const,criterion:'예시 완료 기록',partialCriterion:'',minimumCriterion:'',planId:'',completedAt:d.toISOString()});}
 const back=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
 s.observations=[{id:'o1',kind:'cash',value:3000000,date:today(),note:'가상 예시 금액'},
  {id:'o1b',kind:'cash',value:3450000,date:back(21),note:'가상 예시'},{id:'o1c',kind:'cash',value:2780000,date:back(44),note:'가상 예시'},{id:'o1d',kind:'cash',value:4100000,date:back(70),note:'가상 예시'},{id:'o2',kind:'hours',value:4,date:today(),note:'가상 예시'},{id:'o3',kind:'sleep',value:7,date:today(),note:'가상 예시'}];
 s.rewards=[{id:'r1',title:'초록빛 첫 걸음',type:'digital',cost:0,requiredXp:100,domainId:'',note:'첫 발자국을 남긴 날의 기록',status:'used',spent:null,usedAt:new Date().toISOString(),reservedAt:null},{id:'r2',title:'나를 위한 영화 한 편',type:'real',cost:15000,requiredXp:550,domainId:'recovery',note:'회복 습관이 자랐을 때, 보고 싶었던 영화 한 편',status:'wish',spent:null,usedAt:null,reservedAt:null},{id:'r3',title:'느긋한 오후 산책',type:'real',cost:0,requiredXp:300,domainId:'',note:'느긋하게 걷는 시간',status:'wish',spent:null,usedAt:null,reservedAt:null},{id:'r4',title:'꾸준한 탐험가',type:'digital',cost:0,requiredXp:700,domainId:'',note:'',status:'wish',spent:null,usedAt:null,reservedAt:null}];
 return s;
}
