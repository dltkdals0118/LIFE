import { z } from 'zod';

const id = z.string().min(1).max(150);
const label = z.string().trim().min(1).max(200);
const amount = z.number().finite().min(0).max(1e12);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;},'유효한 날짜를 입력해 주세요.');
export const domainSchema = z.object({id, name:label, color:z.enum(['sage','blue','amber','rose','violet','teal']), icon:z.enum(['wallet','sprout','briefcase','book','heart','sparkles'])});
export const questSchema = z.object({id,title:label,domainId:id,minutes:amount.max(10000),xp:amount.max(50),due:date,status:z.enum(['ready','done','paused']),criterion:z.string().max(2000),partialCriterion:z.string().max(2000).default(''),minimumCriterion:z.string().max(2000).default(''),planId:z.string().max(150),repeat:z.enum(['none','daily','weekly','monthly']).default('none'),completedAt:z.string().nullable(),outcome:z.enum(['full','partial','missed']).nullable().default(null)});
// 전환 조건. `trigger` 는 사람이 읽는 글이고, `rule` 이 있으면 기계도 같이 읽는다.
// 규칙이 없어도 플랜은 그대로 동작한다 — 글만 있는 조건을 억지로 숫자로 바꾸지 않는다.
export const triggerRule = z.discriminatedUnion('when',[
 // 최근 N건의 결과 중 '끝까지'가 아닌 것이 M건 이상이면
 z.object({when:z.literal('outcomes'),recent:z.number().int().min(1).max(30),weak:z.number().int().min(1).max(30),to:z.enum(['A','B','C'])}),
 // 기록한 값이 기준을 밑돌거나 넘으면
 z.object({when:z.literal('observation'),kind:z.enum(['cash','spend','inflow','debt','income','poker-out','poker-in','poker-hours','sleep','weight','exercise','steps','mood','hours','study','late']),op:z.enum(['lt','gt']),value:amount,to:z.enum(['A','B','C'])}),
 // 이 플랜에서 N일 동안 완료가 없으면
 z.object({when:z.literal('idle'),days:z.number().int().min(1).max(365),to:z.enum(['A','B','C'])}),
 // N건을 연달아 끝까지 해내면 (올라가는 쪽)
 z.object({when:z.literal('streak'),full:z.number().int().min(1).max(30),to:z.enum(['A','B','C'])}),
]);
export type TriggerRule=z.infer<typeof triggerRule>;
export const planSchema = z.object({id,title:label,goal:label,domainId:id,active:z.enum(['A','B','C']),branches:z.array(z.object({key:z.enum(['A','B','C']),title:label,cost:amount,hours:amount.max(10000),duration:z.number().int().min(1).max(3650),result:label,trigger:z.string().max(2000),rule:triggerRule.nullable().default(null),switchCost:amount})).length(3)});
export const observationSchema = z.object({id,kind:z.enum(['cash','spend','inflow','debt','income','poker-out','poker-in','poker-hours','sleep','weight','exercise','steps','mood','hours','study','late']),value:amount,date,note:z.string().max(2000)});
export const rewardSchema = z.object({id,title:label,type:z.enum(['digital','real']),cost:amount,requiredXp:amount.max(1e7),domainId:z.string().max(150).default(''),note:z.string().max(1000).default(''),status:z.enum(['wish','reserved','used']),spent:amount.nullable(),usedAt:z.string().nullable(),reservedAt:z.string().nullable().default(null)}).refine(r=>r.type!=='digital'||r.cost===0,'성장 배지는 비용을 0원으로 입력해 주세요.');
export const reviewSchema = z.object({id,date,win:z.string().max(4000),obstacle:z.string().max(4000),next:z.string().max(4000),stats:z.object({done:z.number().int(),full:z.number().int(),partial:z.number().int(),missed:z.number().int(),xp:z.number()}).nullable().default(null)});
// ── 시뮬레이션 ─────────────────────────────────────────────
// 기록->퀘스트->보상은 트래커다. 시뮬레이션이 되려면 **시간이 앞으로 가고, 고른 것에 따라 결과가 갈리고,
// 그걸 직접 돌려볼 수 있어야** 한다. 그래서 레버를 앱에 통째로 싣고 투영을 화면에서 계산한다.
export const leverSchema = z.object({
 id, name:label, starts:z.string().regex(/^\d{4}-\d{2}$/), basis:z.string().max(2000).default(''),
 group:z.string().max(40).default(''),
 options:z.array(z.object({key:z.string().max(4),label:label,delta:z.number().finite(),
   requires:z.array(z.string().max(300)).max(10).default([])})).min(1).max(6),
});
export const simSchema = z.object({
 asOf:date, cash:z.number().finite(), netMonthly:z.number().finite(),
 startMonth:z.string().regex(/^\d{4}-\d{2}$/), months:z.number().int().min(1).max(60),
 flowBasis:z.string().max(1000).default(''), incomeNow:z.number().finite().nullable().default(null),
 groups:z.array(z.object({key:z.string().max(40),name:label,note:z.string().max(300).default('')})).max(8).default([]),
 levers:z.array(leverSchema).max(30),
});
export type Lever=z.infer<typeof leverSchema>;
export type Sim=z.infer<typeof simSchema>;
export const monthAdd=(ym:string,k:number)=>{const t=Number(ym.slice(0,4))*12+Number(ym.slice(5,7))-1+k;
 return `${String(Math.floor(t/12)).padStart(4,'0')}-${String(t%12+1).padStart(2,'0')}`;};
/** 고른 조합으로 달마다 현금을 굴린다. 레버는 시작 달부터 듣는다. */
export function projectCash(sim:Sim,picks:Record<string,string>){
 const rows=[];let cash=sim.cash;
 for(let i=0;i<sim.months;i++){
  const month=monthAdd(sim.startMonth,i);
  let gain=0;
  for(const lv of sim.levers){
   const o=lv.options.find(x=>x.key===(picks[lv.id]??neutralKey(lv)));
   if(o&&month>=lv.starts)gain+=o.delta;
  }
  const flow=sim.netMonthly+gain;cash+=flow;
  rows.push({month,gain,flow,cash});
 }
 const zero=rows.find(r=>r.cash<0);
 const lastGain=rows[rows.length-1].gain;
 return {rows,endCash:rows[rows.length-1].cash,zeroMonth:zero?zero.month:null,
  monthlyFlow:sim.netMonthly+lastGain,
  needPerMonth:Math.max(0,-(sim.netMonthly+lastGain))};   // 수지를 0 으로 만들려면 얼마가 더 필요한가
}
/** 이 조합이 성립하려면 참이어야 하는 것들 */
export function simRequires(sim:Sim,picks:Record<string,string>){
 const out:{lever:string;option:string;items:string[]}[]=[];
 for(const lv of sim.levers){
  const o=lv.options.find(x=>x.key===(picks[lv.id]??neutralKey(lv)));
  if(o&&o.requires.length)out.push({lever:lv.name,option:o.label,items:o.requires});
 }
 return out;
}
/** 중립은 **delta 가 0 인 옵션**이다. 위치나 키 이름으로 찾으면 레버마다 달라 틀린다
 *  — 실제로 '개인회생(-31만)'이 기본값으로 잡힐 뻔했다. */
export const neutralKey=(l:Lever)=>(l.options.find(o=>o.delta===0)
 ??l.options.reduce((a,b)=>Math.abs(b.delta)<Math.abs(a.delta)?b:a)).key;
export const defaultPicks=(sim:Sim)=>Object.fromEntries(sim.levers.map(l=>[l.id,neutralKey(l)]));

// 일기 — 하루에 하나. 웹에서 쓰고 저장소가 받아간다.
export const journalSchema = z.object({
 id, date, text:z.string().max(20000), mood:z.number().int().min(1).max(5).nullable().default(null),
 createdAt:z.string(), updatedAt:z.string(),
});
export type Journal=z.infer<typeof journalSchema>;
/** 같은 날이면 덮어쓴다 — '하루 한 번' 이 규칙이라 날짜가 열쇠다. */
export function upsertJournal(s:Workspace,date:string,text:string,mood:number|null=null){
 const now=new Date().toISOString();
 const body=text.trim();
 const rest=(s.journal??[]).filter(j=>j.date!==date);
 if(!body)return log({...s,journal:rest},`${date} 일기를 비웠어요`);   // 지우는 것도 선택이다
 const old=(s.journal??[]).find(j=>j.date===date);
 const entry:Journal={id:old?.id??uid(),date,text:body,mood,
  createdAt:old?.createdAt??now,updatedAt:now};
 return log({...s,journal:[entry,...rest].sort((a,b)=>b.date.localeCompare(a.date))},
  `${date} 일기를 ${old?'고쳤어요':'남겼어요'}`);
}
export const journalOf=(s:Workspace,date:string)=>(s.journal??[]).find(j=>j.date===date)??null;
/** 며칠 연달아 썼나. 오늘 아직 안 썼으면 어제부터 센다 — 하루 쉬었다고 0 이 되면 안 적게 된다. */
export function journalStreak(s:Workspace,from=today()){
 const have=new Set((s.journal??[]).map(j=>j.date));
 let d=new Date(from+'T00:00:00Z');
 if(!have.has(from))d=new Date(d.getTime()-86400000);
 let n=0;
 for(;;){const k=d.toISOString().slice(0,10);if(!have.has(k))break;n++;d=new Date(d.getTime()-86400000);}
 return n;
}

export const workspaceSchema = z.object({schemaVersion:z.literal(1),name:label,chapter:label,domains:z.array(domainSchema).min(1).max(30),quests:z.array(questSchema).max(20000),plans:z.array(planSchema).max(500),observations:z.array(observationSchema).max(30000),rewards:z.array(rewardSchema).max(1000),reviews:z.array(reviewSchema).max(2000),rewardBudget:amount.nullable(),sim:simSchema.nullable().default(null),journal:z.array(journalSchema).max(5000).default([]),events:z.array(z.object({id,at:z.string(),text:z.string().max(1000)})).max(20000)}).superRefine((s,ctx)=>{
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
// ── 게임 층 ──────────────────────────────────────────────────────────
// 분야를 능력치로 읽는다. **스탯은 레벨에만 의존한다** — XP 는 게이지로 차오르고
// 스탯은 레벨업 순간 +10 으로 점프한다. 조금씩 올라가면 '세졌다'가 느껴지지 않는다.
export const STAT:Record<string,string>={finance:'재력',recovery:'체력',career:'기술',learning:'지력',relationships:'인맥',creative:'창의'};
export const statName=(domainId:string)=>STAT[domainId]??'기타';
export const statOf=(s:Workspace,domainId:string)=>level(xpOf(s,domainId)).level*10;
export const combatPower=(s:Workspace)=>s.domains.reduce((n,d)=>n+statOf(s,d.id),0);
export function statList(s:Workspace){return s.domains.map(d=>{const xp=xpOf(s,d.id),lv=level(xp);
 return {domain:d,name:statName(d.id),value:lv.level*10,level:lv.level,progress:lv.progress,remaining:lv.remaining,xp};});}

// 레벨업으로 전투력이 얼마나 올랐나. 올라간 스탯을 함께 돌려줘서 연출에 쓴다.
export function powerDiff(before:Workspace,after:Workspace){
 const ups=after.domains.map(d=>({domain:d,name:statName(d.id),from:statOf(before,d.id),to:statOf(after,d.id),level:level(xpOf(after,d.id)).level}))
  .filter(x=>x.to>x.from);
 return {from:combatPower(before),to:combatPower(after),ups};
}

// **한 번에 하나만 띄운다.** 목록 20개는 고르는 일이 되고, 고르는 일은 미루게 된다.
// 순서: 마감 지난·오늘 것 먼저, 같은 날이면 **짧은 것 먼저** — 완료 경험을 빨리 준다.
export function questQueue(s:Workspace,date=today()){
 const rank=(q:Quest)=>q.due<=date?0:1;
 return s.quests.filter(q=>q.status==='ready')
  .sort((a,b)=>rank(a)-rank(b)||a.due.localeCompare(b.due)||a.minutes-b.minutes||a.title.localeCompare(b.title));
}
export const focusQuest=(s:Workspace,date=today())=>questQueue(s,date)[0]??null;
export const clearedToday=(s:Workspace,date=today())=>
 s.quests.some(q=>q.completedAt?.slice(0,10)===date)&&!s.quests.some(q=>q.status==='ready'&&q.due<=date);

// 서브퀘스트 — **오늘 걸 다 끝냈을 때만** 열린다. 그래서 자연히 '가끔'이 된다.
// 날짜로 고르므로 하루 안에서는 같은 것이 나오고 날마다 바뀐다(무작위가 아니라 재현된다).
export const SUBQUESTS=[
 {title:'푸시업 20개',domainId:'recovery',minutes:5,xp:5,criterion:'한 번에 안 되면 나눠서 해도 20개면 된다.'},
 {title:'10분 걷기',domainId:'recovery',minutes:10,xp:5,criterion:'밖에 나가 10분 걸었다.'},
 {title:'스트레칭 5분',domainId:'recovery',minutes:5,xp:4,criterion:'어깨·허리·햄스트링을 펴 줬다.'},
 {title:'물 1리터 마시기',domainId:'recovery',minutes:1,xp:4,criterion:'오늘 물 1리터를 마셨다.'},
 {title:'스쿼트 30개',domainId:'recovery',minutes:5,xp:5,criterion:'나눠서 해도 30개면 된다.'},
 {title:'책 5쪽 더',domainId:'learning',minutes:10,xp:5,criterion:'오늘 몫 외에 5쪽을 더 읽었다.'},
 {title:'영수증 하나 기록',domainId:'finance',minutes:3,xp:4,criterion:'오늘 쓴 것 하나를 앱에 적었다.'},
 {title:'포커 핸드 리뷰 1개',domainId:'learning',minutes:15,xp:6,criterion:'아쉬웠던 핸드 하나를 되짚었다.'},
] as const;
const dayIndex=(date:string)=>Math.floor(Date.parse(`${date}T00:00:00Z`)/86400000);
export const SUB_PREFIX='보너스 — ';
export const isSubQuest=(q:Quest)=>q.title.startsWith(SUB_PREFIX);
export function subQuestFor(s:Workspace,date=today()){
 if(!clearedToday(s,date))return null;                                  // 다 끝내야 열린다
 if(s.quests.some(q=>isSubQuest(q)&&q.due===date))return null;          // 하루에 하나
 return SUBQUESTS[((dayIndex(date)%SUBQUESTS.length)+SUBQUESTS.length)%SUBQUESTS.length];
}
export function acceptSubQuest(s:Workspace,date=today()){
 const t=subQuestFor(s,date); if(!t)throw Error('지금은 열린 보너스가 없어요.');
 const q:Quest={id:uid(),title:`${SUB_PREFIX}${t.title}`,domainId:t.domainId,minutes:t.minutes,xp:t.xp,due:date,
  status:'ready',criterion:t.criterion,partialCriterion:'',minimumCriterion:'',planId:'',repeat:'none',completedAt:null,outcome:null};
 return log({...s,quests:[q,...s.quests]},`보너스 수락 · ${t.title}`);
}

// 충돌 화면이 퀘스트·기록 수만 보여줘서, **플랜 7→1 과 보상 10→0 이 사라지는 선택을 구분할 수 없었다**
// (2026-11-05 실제로 그렇게 줄었다). 사라지는 쪽을 숫자로 대 준다.
export const COUNTED=[['quests','퀘스트'],['plans','플랜'],['observations','기록'],['rewards','보상'],['reviews','회고']] as const;
export function compareWorkspaces(mine:Workspace,theirs:Workspace){
 const rows=COUNTED.map(([key,label])=>({key,label,mine:mine[key].length,theirs:theirs[key].length,
  diff:mine[key].length-theirs[key].length}));
 return {rows,
  mineLoses:rows.filter(r=>r.diff>0),      // '서버 기록 사용' 을 고르면 사라지는 것
  theirsLoses:rows.filter(r=>r.diff<0)};   // '이 기기 기록 사용' 을 고르면 사라지는 것
}

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
function nextDue(due:string,repeat:'daily'|'weekly'|'monthly'){
 const t=today();
 let d=new Date(due+'T00:00:00Z');
 if(repeat==='monthly'){
  // 달을 더한다. 31일이 없는 달은 그 달 마지막 날로 내린다 — 1/31 이 3/3 으로 건너뛰지 않게.
  const day=d.getUTCDate();
  do{
   const y=d.getUTCFullYear(),m=d.getUTCMonth()+1;
   const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
   d=new Date(Date.UTC(y,m,Math.min(day,last)));
  }while(d.toISOString().slice(0,10)<=t);
  return d.toISOString().slice(0,10);
 }
 const step=repeat==='daily'?1:7;
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
export const OBS_NAME={cash:'가용 현금',spend:'월 총유출',inflow:'월 총유입',debt:'채무 잔액',income:'수입',
 'poker-out':'포커 송금','poker-in':'포커 회수','poker-hours':'포커 시간',
 sleep:'수면 시간',weight:'체중',exercise:'운동 시간',steps:'걸음 수',mood:'컨디션',
 hours:'주간 가용시간',study:'공부 시간',late:'지각'} as const;
export const OBS_UNIT={cash:'원',spend:'원',inflow:'원',debt:'원',income:'원',
 'poker-out':'원','poker-in':'원','poker-hours':'시간',
 sleep:'시간',weight:'kg',exercise:'분',steps:'걸음',mood:'점(1~5)',
 hours:'시간',study:'분',late:'회'} as const;
// 고를 것이 14개면 한 줄로 늘어놓을 수 없다. 묶어서 보여준다.
export const OBS_GROUPS:[string,(keyof typeof OBS_NAME)[]][]=[
 ['돈',['cash','spend','inflow','debt','income']],
 ['포커',['poker-out','poker-in','poker-hours']],
 ['몸',['sleep','weight','exercise','steps','mood']],
 ['시간과 배움',['hours','study','late']],
];
// 범위는 **한 곳에서만** 정한다. 화면마다 따로 적으면 갈라진다(수면 24h 검사가 그랬다).
const OBS_MAX:Partial<Record<keyof typeof OBS_NAME,number>>={sleep:24,'poker-hours':24,hours:168,
 weight:300,mood:5,exercise:1440,study:1440,steps:200000,late:31};
const OBS_MIN:Partial<Record<keyof typeof OBS_NAME,number>>={weight:20,mood:1};
export function checkObservation(kind:keyof typeof OBS_NAME,value:number):string|null{
 const hi=OBS_MAX[kind],lo=OBS_MIN[kind],u=OBS_UNIT[kind];
 if(lo!==undefined&&value<lo)return `${OBS_NAME[kind]}은(는) ${lo}${u} 이상으로 입력해 주세요.`;
 if(hi!==undefined&&value>hi)return `${OBS_NAME[kind]}은(는) ${hi}${u} 이하로 입력해 주세요.`;
 return null;
}
export const obsText=(kind:keyof typeof OBS_NAME,value:number)=>
 OBS_UNIT[kind]==='원'?won(value):`${value}${OBS_UNIT[kind]==='점(1~5)'?'점':OBS_UNIT[kind]}`;
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
export function createEmpty():Workspace{return {schemaVersion:1,name:'나의 LIFE',chapter:'나의 속도로, 다음 한 걸음',domains:[{id:'finance',name:'재정 운영',color:'sage',icon:'wallet'},{id:'recovery',name:'회복 습관',color:'teal',icon:'sprout'},{id:'career',name:'일과 성장',color:'blue',icon:'briefcase'},{id:'learning',name:'배움',color:'amber',icon:'book'},{id:'relationships',name:'관계',color:'rose',icon:'heart'},{id:'creative',name:'창작',color:'violet',icon:'sparkles'}],quests:[],plans:[],observations:[],rewards:[],reviews:[],rewardBudget:null,sim:null,journal:[],events:[]};}
export function createDemo():Workspace{
 const s=createEmpty();s.name='나의 작은 우주';s.chapter='조금 더 단단한 일상 만들기';s.rewardBudget=50000;
 s.plans=[{id:'plan-1',title:'생활의 여유 만들기',goal:'이번 달 정기 지출 3개 점검하기',domainId:'finance',active:'A',branches:[{key:'A',title:'작은 것부터 차근차근',cost:0,hours:2,duration:30,result:'정기 지출 3개 확인',trigger:'2주 동안 진행이 없다면 B 검토',rule:{when:'idle',days:14,to:'B'},switchCost:0},{key:'B',title:'한 가지에 집중하기',cost:0,hours:1,duration:30,result:'가장 큰 지출 1개 확인',trigger:'주간 여유가 1시간 미만이면 C 검토',rule:{when:'observation',kind:'hours',op:'lt',value:1,to:'C'},switchCost:0},{key:'C',title:'기록만 이어가기',cost:0,hours:0.25,duration:30,result:'월말 잔액 1회 기록',trigger:'세 번 연달아 해내면 다시 올라간다',rule:{when:'streak',full:3,to:'A'},switchCost:0}]}];
 s.quests=[{id:'q1',title:'이번 달 정기결제 살펴보기',domainId:'finance',minutes:10,xp:15,due:today(),status:'ready',outcome:null,repeat:'none' as const,partialCriterion:'',minimumCriterion:'',criterion:'정기결제 목록과 다음 결제일을 기록했어요.',planId:'plan-1',completedAt:null},{id:'q2',title:'잠들기 전, 오늘의 수면 기록',domainId:'recovery',minutes:2,xp:5,due:today(),status:'ready',outcome:null,repeat:'none' as const,partialCriterion:'',minimumCriterion:'',criterion:'지난밤의 수면 시간을 기록했어요.',planId:'',completedAt:null},{id:'q3',title:'읽고 싶었던 책, 10쪽',domainId:'learning',minutes:15,xp:15,due:today(),status:'ready',outcome:null,repeat:'none' as const,partialCriterion:'',minimumCriterion:'',criterion:'10쪽을 읽고 기억할 문장 하나를 남겼어요.',planId:'',completedAt:null}];
 for(let i=0;i<18;i++){const d=new Date();d.setDate(d.getDate()-(i%7)-1);s.quests.push({id:`history-${i}`,title:['지난주 기록 정리','작은 배움 남기기','한 걸음 산책'][i%3],domainId:s.domains[i%6].id,minutes:10,xp:30,due:d.toISOString().slice(0,10),status:'done',outcome:i%5===0?'partial':'full',repeat:'none' as const,criterion:'예시 완료 기록',partialCriterion:'',minimumCriterion:'',planId:'',completedAt:d.toISOString()});}
 const back=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
 s.observations=[{id:'o1',kind:'cash',value:3000000,date:today(),note:'가상 예시 금액'},
  {id:'o1b',kind:'cash',value:3450000,date:back(21),note:'가상 예시'},{id:'o1c',kind:'cash',value:2780000,date:back(44),note:'가상 예시'},{id:'o1d',kind:'cash',value:4100000,date:back(70),note:'가상 예시'},{id:'o2',kind:'hours',value:4,date:today(),note:'가상 예시'},{id:'o3',kind:'sleep',value:7,date:today(),note:'가상 예시'}];
 s.rewards=[{id:'r1',title:'초록빛 첫 걸음',type:'digital',cost:0,requiredXp:100,domainId:'',note:'첫 발자국을 남긴 날의 기록',status:'used',spent:null,usedAt:new Date().toISOString(),reservedAt:null},{id:'r2',title:'나를 위한 영화 한 편',type:'real',cost:15000,requiredXp:550,domainId:'recovery',note:'회복 습관이 자랐을 때, 보고 싶었던 영화 한 편',status:'wish',spent:null,usedAt:null,reservedAt:null},{id:'r3',title:'느긋한 오후 산책',type:'real',cost:0,requiredXp:300,domainId:'',note:'느긋하게 걷는 시간',status:'wish',spent:null,usedAt:null,reservedAt:null},{id:'r4',title:'꾸준한 탐험가',type:'digital',cost:0,requiredXp:700,domainId:'',note:'',status:'wish',spent:null,usedAt:null,reservedAt:null}];
 // 예시 공간에도 시뮬레이션을 넣는다 — 가져오기 전에도 '무엇을 돌려보는 것인지' 가 보여야 한다.
 s.sim={asOf:today(),cash:3000000,netMonthly:-1800000,startMonth:monthAdd(today().slice(0,7),1),months:6,flowBasis:'예시 값이에요. 내 기록을 가져오면 내 숫자와 내 손잡이로 바뀝니다.',incomeNow:2600000,groups:[{key:'cut',name:'줄이기',note:'지금 당길 수 있는 것들'},{key:'earn',name:'늘리기',note:'금액이 미확인이면 민감도로만 본다'},{key:'structure',name:'구조 바꾸기',note:'되돌리기 어렵다. 숫자보다 조건을 먼저 본다'}],levers:[{id:'food',name:'식비·카페',group:'cut',starts:monthAdd(today().slice(0,7),1),basis:'예시 — 보통 가장 큰 칸이에요.',options:[{key:'A',label:'월 80만',delta:800000,requires:['주 단위 상한을 정하고 지킨다','배달·카페를 주 N회로 못 박는다']},{key:'B',label:'월 40만',delta:400000,requires:['주 단위 상한을 정한다']},{key:'C',label:'그대로',delta:0,requires:[]}]},{id:'subs',name:'구독·정기결제',group:'cut',starts:monthAdd(today().slice(0,7),1),basis:'예시 — 목록부터 봐야 해요.',options:[{key:'A',label:'월 7만',delta:70000,requires:['결제 내역에서 구독을 전부 찾아낸다','안 쓰는 것을 해지한다']},{key:'B',label:'그대로',delta:0,requires:[]}]},{id:'telecom',name:'통신 요금',group:'cut',starts:monthAdd(today().slice(0,7),1),basis:'예시 — 약정이 변수예요.',options:[{key:'A',label:'월 10만',delta:100000,requires:['약정과 위약금을 확인한다']},{key:'B',label:'월 5만',delta:50000,requires:['약정을 확인한다']},{key:'C',label:'그대로',delta:0,requires:[]}]},{id:'rate',name:'대출 금리',group:'cut',starts:monthAdd(today().slice(0,7),1),basis:'예시 — 1%p 면 잔액에 따라 달라요.',options:[{key:'A',label:'월 10만',delta:100000,requires:['금리 인하 요구권을 신청한다','중도상환수수료를 확인한다']},{key:'B',label:'그대로',delta:0,requires:[]}]},{id:'promo',name:'연봉·승진',group:'earn',starts:monthAdd(today().slice(0,7),2),basis:'예시 — 금액이 미확인이면 0 으로 두고 필요한 액수를 역산해요.',options:[{key:'A',label:'만약 +80만이라면',delta:800000,requires:['근거가 될 결과물을 만든다']},{key:'B',label:'만약 +50만이라면',delta:500000,requires:['근거가 될 결과물을 만든다']},{key:'C',label:'모름 — 0',delta:0,requires:[]}]},{id:'side',name:'부업',group:'earn',starts:monthAdd(today().slice(0,7),2),basis:'예시 — 아직 매출이 없으면 0 이에요.',options:[{key:'A',label:'만약 월 50만이라면',delta:500000,requires:['첫 거래를 한 건 만든다']},{key:'B',label:'안 한다 / 모름',delta:0,requires:[]}]},{id:'housing',name:'주거',group:'structure',starts:monthAdd(today().slice(0,7),5),basis:'예시 — 계약 만료에 맞춰 결정해요.',options:[{key:'A',label:'월 30만',delta:300000,requires:['대안을 미리 알아본다','통보 기한을 확인한다']},{key:'B',label:'그대로',delta:0,requires:[]}]}]};
 return s;
}
