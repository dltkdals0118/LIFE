import {type Workspace,type Sim,type Decision,simSchema,picksOf,projectCash,uid,today,log,latest} from './model';

export function baselineNotice(s:Workspace){
 if(!s.sim)return '현재 상황을 입력하면 선택 비교를 시작할 수 있어요.';
 const cash=latest(s,'cash');
 if(cash&&cash.date>s.sim.asOf)return `${cash.date} 현금 기록이 기준일보다 새로워요. 기준값과 계산 기간을 검토해 주세요.`;
 if(s.sim.asOf<today().slice(0,7)+'-01')return `기준일은 ${s.sim.asOf}입니다. 현재 상황과 다른지 확인해 주세요.`;
 return null;
}
export function saveBaseline(s:Workspace,sim:Sim):Workspace{
 const parsed=simSchema.parse(sim);
 if(parsed.startMonth<=parsed.asOf.slice(0,7))throw Error('계산 시작월은 기준일 다음 달 이후로 정해 주세요. 기준월의 부분 기간은 계산하지 않습니다.');
 return log({...s,sim:parsed},'시뮬레이션 기준값 수정 · 이전 채택 기록은 보존');
}
export function adoptScenario(s:Workspace,input:{title:string;goal:string;reviewDate:string;action:string;criterion:string;minutes:number;assumptions:string}):Workspace{
 if(!s.sim)throw Error('먼저 현재 상황을 입력해 주세요.');
 if(s.decisions.some(d=>d.status==='active'))throw Error('진행 중인 계획을 먼저 검토해 주세요. 같은 자원을 두 계획에 중복 배정하지 않습니다.');
 if(input.reviewDate<today())throw Error('재검토 날짜는 오늘 이후로 정해 주세요.');
 const picks=picksOf(s),r=projectCash(s.sim,picks);
 if(r.freeHours===null)throw Error('실행 가능성을 확인하려면 하루 가용시간을 입력해 주세요.');
 if(r.timeBlocked)throw Error('시간이 부족한 달이 있습니다. 선택을 조정한 뒤 채택해 주세요.');
 const actionId=uid();
 const decision:Decision={id:uid(),title:input.title,goal:input.goal,reviewDate:input.reviewDate,createdAt:new Date().toISOString(),modelVersion:'monthly-v2',sim:structuredClone(s.sim),picks:{...picks},actionId,assumptions:input.assumptions,status:'active',review:null};
 return log({...s,decisions:[decision,...s.decisions],quests:[{id:actionId,title:input.action,criterion:input.criterion,minutes:input.minutes,domainId:s.domains[0].id,xp:15,due:input.reviewDate,status:'ready',outcome:null,repeat:'none',partialCriterion:'',minimumCriterion:'',planId:'',completedAt:null},...s.quests]},'선택을 실행 계획으로 채택');
}
export function reviewDecision(s:Workspace,id:string,review:NonNullable<Decision['review']>):Workspace{
 const d=s.decisions.find(d=>d.id===id);
 if(!d||d.status!=='active')throw Error('진행 중인 계획을 선택해 주세요.');
 if(review.actualCash!==null){
  if(!review.actualMonth||review.actualMonth>=today().slice(0,7))throw Error('실제 잔액 비교에는 종료된 월의 월말 잔액을 입력해 주세요.');
  if(!projectCash(d.sim,d.picks).rows.some(r=>r.month===review.actualMonth))throw Error('당시 예측 기간 안의 월을 선택해 주세요.');
 }
 return log({...s,decisions:s.decisions.map(x=>x.id===id?{...x,status:'reviewed',review}:x)},'실행 결과 검토 · 당시 예측 보존');
}
