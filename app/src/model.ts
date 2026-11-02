import { z } from 'zod';

const id = z.string().min(1).max(150);
const label = z.string().trim().min(1).max(200);
const amount = z.number().finite().min(0).max(1e12);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;},'유효한 날짜를 입력해 주세요.');
export const domainSchema = z.object({id, name:label, color:z.enum(['sage','blue','amber','rose','violet','teal']), icon:z.enum(['wallet','sprout','briefcase','book','heart','sparkles'])});
export const questSchema = z.object({id,title:label,domainId:id,minutes:amount.max(10000),xp:amount.max(50),due:date,status:z.enum(['ready','done','paused']),criterion:z.string().max(2000),planId:z.string().max(150),completedAt:z.string().nullable(),outcome:z.enum(['full','partial','missed']).nullable().default(null)});
export const planSchema = z.object({id,title:label,goal:label,domainId:id,active:z.enum(['A','B','C']),branches:z.array(z.object({key:z.enum(['A','B','C']),title:label,cost:amount,hours:amount.max(10000),duration:z.number().int().min(1).max(3650),result:label,trigger:z.string().max(2000),switchCost:amount})).length(3)});
export const observationSchema = z.object({id,kind:z.enum(['cash','hours','sleep','poker-out','poker-in']),value:amount,date,note:z.string().max(2000)});
export const rewardSchema = z.object({id,title:label,type:z.enum(['digital','real']),cost:amount,requiredXp:amount.max(1e7),status:z.enum(['wish','reserved','used']),spent:amount.nullable(),usedAt:z.string().nullable()}).refine(r=>r.type!=='digital'||r.cost===0,'성장 배지는 비용을 0원으로 입력해 주세요.');
export const reviewSchema = z.object({id,date,win:z.string().max(4000),obstacle:z.string().max(4000),next:z.string().max(4000)});
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
export function level(xp:number){let l=1;while(50*l*(l+1)<=xp)l++;const floor=50*(l-1)*l,ceil=50*l*(l+1);return {level:l,progress:(xp-floor)/(ceil-floor),next:ceil,remaining:ceil-xp};}
export function latest(s:Workspace,kind:Observation['kind']){return s.observations.filter(o=>o.kind===kind).sort((a,b)=>b.date.localeCompare(a.date))[0]??null;}
export function log(s:Workspace,text:string){return {...s,events:[{id:uid(),at:new Date().toISOString(),text},...s.events].slice(0,20000)};}
export function completeQuest(s:Workspace,id:string,outcome:Outcome='full'){
 const q=s.quests.find(x=>x.id===id);if(!q)return s;
 const done=q.status!=='done';
 const next={...q,status:(done?'done':'ready') as Quest['status'],completedAt:done?new Date().toISOString():null,outcome:done?outcome:null};
 const gained=done?questXp(next):0;
 return log({...s,quests:s.quests.map(x=>x.id===id?next:x)},
   done?`${q.title} · ${OUTCOME[outcome].label} (+${gained} XP)`:`${q.title} · 완료 취소`);
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
export function reserveReward(s:Workspace,id:string){const r=s.rewards.find(x=>x.id===id);if(!r||r.status!=='wish')throw Error('예약 가능한 보상이 아닙니다.');if(xpOf(s)<r.requiredXp)throw Error('잠금 해제 조건을 먼저 달성해 주세요.');const available=rewardAvailable(s);if(r.type==='real'&&r.cost>0&&(available===null||available<r.cost))throw Error('보상 예산을 설정하거나 예약 금액을 조정해 주세요.');return log({...s,rewards:s.rewards.map(x=>x.id===id?{...x,status:r.type==='digital'?'used':'reserved',usedAt:r.type==='digital'?new Date().toISOString():null}:x)},`${r.title} · ${r.type==='digital'?'획득':'예약'}`);}
export function assessBranch(s:Workspace,p:Plan,key:Plan['active']){const b=p.branches.find(x=>x.key===key)!;const cash=latest(s,'cash'),hours=latest(s,'hours');const cost=b.cost+(key!==p.active?b.switchCost:0);const reasons:string[]=[];if(cash===null)reasons.push('현금 기록 필요');else if(cash.value<cost)reasons.push(`필요 자금 ${won(cost-cash.value)} 부족`);if(hours===null)reasons.push('주간 가용시간 기록 필요');else if(hours.value<b.hours)reasons.push(`주 ${b.hours-hours.value}시간 부족`);const unknown=cash===null||hours===null;return {cost,cash,hours,reasons,state:reasons.length?(unknown&&!reasons.some(x=>x.includes('부족'))?'unknown':'blocked'):'ready'};}
export function parseBackup(raw:unknown){return workspaceSchema.parse(raw);}
export function createEmpty():Workspace{return {schemaVersion:1,name:'나의 LIFE',chapter:'나의 속도로, 다음 한 걸음',domains:[{id:'finance',name:'재정 운영',color:'sage',icon:'wallet'},{id:'recovery',name:'회복 습관',color:'teal',icon:'sprout'},{id:'career',name:'일과 성장',color:'blue',icon:'briefcase'},{id:'learning',name:'배움',color:'amber',icon:'book'},{id:'relationships',name:'관계',color:'rose',icon:'heart'},{id:'creative',name:'창작',color:'violet',icon:'sparkles'}],quests:[],plans:[],observations:[],rewards:[],reviews:[],rewardBudget:null,events:[]};}
export function createDemo():Workspace{
 const s=createEmpty();s.name='나의 작은 우주';s.chapter='조금 더 단단한 일상 만들기';s.rewardBudget=50000;
 s.plans=[{id:'plan-1',title:'생활의 여유 만들기',goal:'이번 달 정기 지출 3개 점검하기',domainId:'finance',active:'A',branches:[{key:'A',title:'작은 것부터 차근차근',cost:0,hours:2,duration:30,result:'정기 지출 3개 확인',trigger:'2주 동안 진행이 없다면 B 검토',switchCost:0},{key:'B',title:'한 가지에 집중하기',cost:0,hours:1,duration:30,result:'가장 큰 지출 1개 확인',trigger:'주간 여유가 1시간 미만이면 C 검토',switchCost:0},{key:'C',title:'기록만 이어가기',cost:0,hours:0.25,duration:30,result:'월말 잔액 1회 기록',trigger:'다음 주 가용시간을 다시 확인',switchCost:0}]}];
 s.quests=[{id:'q1',title:'이번 달 정기결제 살펴보기',domainId:'finance',minutes:10,xp:15,due:today(),status:'ready',outcome:null,criterion:'정기결제 목록과 다음 결제일을 기록했어요.',planId:'plan-1',completedAt:null},{id:'q2',title:'잠들기 전, 오늘의 수면 기록',domainId:'recovery',minutes:2,xp:5,due:today(),status:'ready',outcome:null,criterion:'지난밤의 수면 시간을 기록했어요.',planId:'',completedAt:null},{id:'q3',title:'읽고 싶었던 책, 10쪽',domainId:'learning',minutes:15,xp:15,due:today(),status:'ready',outcome:null,criterion:'10쪽을 읽고 기억할 문장 하나를 남겼어요.',planId:'',completedAt:null}];
 for(let i=0;i<18;i++){const d=new Date();d.setDate(d.getDate()-(i%7)-1);s.quests.push({id:`history-${i}`,title:['지난주 기록 정리','작은 배움 남기기','한 걸음 산책'][i%3],domainId:s.domains[i%6].id,minutes:10,xp:30,due:d.toISOString().slice(0,10),status:'done',outcome:i%5===0?'partial':'full',criterion:'예시 완료 기록',planId:'',completedAt:d.toISOString()});}
 const back=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
 s.observations=[{id:'o1',kind:'cash',value:3000000,date:today(),note:'가상 예시 금액'},
  {id:'o1b',kind:'cash',value:3450000,date:back(21),note:'가상 예시'},{id:'o1c',kind:'cash',value:2780000,date:back(44),note:'가상 예시'},{id:'o1d',kind:'cash',value:4100000,date:back(70),note:'가상 예시'},{id:'o2',kind:'hours',value:4,date:today(),note:'가상 예시'},{id:'o3',kind:'sleep',value:7,date:today(),note:'가상 예시'}];
 s.rewards=[{id:'r1',title:'초록빛 첫 걸음',type:'digital',cost:0,requiredXp:100,status:'used',spent:null,usedAt:new Date().toISOString()},{id:'r2',title:'나를 위한 영화 한 편',type:'real',cost:15000,requiredXp:550,status:'wish',spent:null,usedAt:null},{id:'r3',title:'느긋한 오후 산책',type:'real',cost:0,requiredXp:300,status:'wish',spent:null,usedAt:null},{id:'r4',title:'꾸준한 탐험가',type:'digital',cost:0,requiredXp:700,status:'wish',spent:null,usedAt:null}];
 return s;
}
