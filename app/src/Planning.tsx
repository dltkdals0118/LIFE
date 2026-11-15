import {useState,type FormEvent,type ReactNode} from 'react';
import {type Workspace,type Sim,type Lever,simSchema,leverSchema,today,monthAdd,uid,picksOf,projectCash,won,simRequires,OBS_NAME,obsText} from './model';
import {adoptScenario,baselineNotice,saveBaseline,reviewDecision} from './planning';
import './planning.css';
const Field=({label,children}:{label:string;children:ReactNode})=><label className="field"><span>{label}</span>{children}</label>;
const str=(f:FormData,k:string)=>String(f.get(k)??'').trim();
const num=(f:FormData,k:string)=>{const v=str(f,k);if(!v||!Number.isFinite(Number(v)))throw Error('숫자 항목을 확인해 주세요.');return Number(v);};
const nullable=(f:FormData,k:string)=>str(f,k)===''?null:num(f,k);
export default function Planning({s,update,onSim,onQuest,onRecord,onReview,onEdit,ready}:{s:Workspace;update:(fn:(s:Workspace)=>Workspace)=>unknown;onSim:()=>void;onQuest:(id?:string)=>void;onEdit:(id:string)=>void;onRecord:()=>void;onReview:()=>void;ready:boolean}){
 const [message,setMessage]=useState('');
 const run=(fn:(s:Workspace)=>Workspace)=>{try{update(fn);setMessage('저장했어요.');}catch(e){setMessage(e instanceof Error?e.message:'입력을 확인해 주세요.');}};
 const form=(fn:(f:FormData)=>void)=>(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();try{fn(new FormData(e.currentTarget));}catch(e){setMessage(e instanceof Error?e.message:'입력을 확인해 주세요.');}};
 const notice=baselineNotice(s),sim=s.sim,active=s.decisions.find(d=>d.status==='active');
 return <div className="planning"><div className="page-heading"><div><span className="eyebrow">DECIDE · DO · REVIEW</span><h1>실행과 검토</h1><p>현재 상황 → 선택 비교 → 이번 주 행동 → 실제 결과. 한 조합씩 검토해요.</p></div></div>
 {message&&<p role="status" className="notice">{message}</p>}
 {notice&&<p className="notice warn">{notice}</p>}
 <fieldset disabled={!ready} className="planning-fieldset">
 <section className="panel"><h2>1. 현재 상황</h2><p>입력값은 가정 계산의 기준입니다. 실제 관측과 과거 예측은 자동으로 덮어쓰지 않아요.</p>
 <details open={!sim}><summary>기준값 {sim?'수정':'입력'}</summary>
 <form key={JSON.stringify([sim?.asOf,sim?.cash,sim?.netMonthly,sim?.baseFreeHours,sim?.months])} onSubmit={form(f=>run(w=>saveBaseline(w,simSchema.parse({...w.sim,asOf:str(f,'asOf'),cash:num(f,'cash'),netMonthly:num(f,'flow'),startMonth:str(f,'start'),months:num(f,'months'),baseFreeHours:nullable(f,'hours'),incomeNow:nullable(f,'income'),flowBasis:str(f,'basis'),levers:w.sim?.levers??[],groups:w.sim?.groups??[]}))))}>
 <div className="form-grid">
 <Field label="기준일"><input name="asOf" type="date" required max={today()} defaultValue={sim?.asOf??today()}/></Field>
 <Field label="기준 현금 (원)"><input name="cash" type="number" required step="1" defaultValue={sim?.cash}/></Field>
 <Field label="월수지 (유입 − 유출, 적자는 음수)"><input name="flow" type="number" required step="1" defaultValue={sim?.netMonthly}/></Field>
 <Field label="계산 시작월"><input name="start" type="month" required defaultValue={sim?.startMonth??monthAdd(today().slice(0,7),1)}/></Field>
 <Field label="계산 기간 (개월)"><input name="months" type="number" required min="1" max="60" defaultValue={sim?.months??6}/></Field>
 <Field label="하루 가용시간 (모르면 비워 두기)"><input name="hours" type="number" min="0" max="24" step="0.1" defaultValue={sim?.baseFreeHours??''}/></Field>
 <Field label="현재 월수입 (원, 모르면 비워 두기)"><input name="income" type="number" min="0" defaultValue={sim?.incomeNow??''}/></Field>
 </div><Field label="수치의 근거와 미확인 사항"><textarea name="basis" required maxLength={1000} defaultValue={sim?.flowBasis} placeholder="어느 기간의 기록인지, 포함된 지출과 빠진 항목을 적어 주세요."/></Field>
 <p className="small-note">월수지에는 필수 생활비·상환·예정 지출을 포함해 주세요. 기준월의 남은 기간은 계산하지 않으므로 시작월 직전 월말의 예상 잔액을 기준 현금으로 조정해야 할 수 있어요. 월중 결제일과 일시 비용은 이 모델이 계산하지 않습니다.</p>
 <button className="primary">기준값 저장</button></form></details>
 <button className="secondary" type="button" onClick={onRecord}>실제 관측 추가</button>
 {s.observations.length>0&&<details><summary>최근 실제 관측 {s.observations.length}건</summary><ul>{[...s.observations].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(o=><li key={o.id}>{o.date} · {OBS_NAME[o.kind]}: {obsText(o.kind,o.value)} {o.note&&`— ${o.note}`}</li>)}</ul></details>}
 </section>
 {sim&&<><section className="panel"><h2>2. 비교할 선택</h2><p>같은 절감액을 여러 항목에 중복 입력하지 마세요. 수입 증가액은 보장된 수익이 아닌 가정입니다.</p>
 {sim.levers.map(l=><details key={l.id}><summary>{l.name} · {l.starts}부터</summary><LeverForm lever={l} onSave={v=>run(w=>({...w,sim:{...w.sim!,levers:w.sim!.levers.map(x=>x.id===v.id?v:x)}}))}/><button className="text-button danger" onClick={()=>{if(confirm('이 선택 항목을 삭제할까요? 채택 당시의 기록은 보존됩니다.'))run(w=>({...w,sim:{...w.sim!,levers:w.sim!.levers.filter(x=>x.id!==l.id)},simPicks:Object.fromEntries(Object.entries(w.simPicks).filter(([k])=>k!==l.id))}));}}>선택 항목 삭제</button></details>)}
 {sim.levers.length<30&&<details><summary>선택 항목 추가</summary><LeverForm onSave={v=>run(w=>({...w,sim:{...w.sim!,levers:[...w.sim!.levers,v]}}))}/></details>}
 <button className="primary" onClick={onSim}>조합 비교하기</button></section>
 <section className="panel"><h2>3. 이번 주 실행으로 채택</h2>{active?<p>진행 중: <b>{active.title}</b>. 아래에서 검토한 뒤 다음 조합을 채택할 수 있어요.</p>:<>
 <p>현재 선택한 조합의 조건을 확인하고, 완료 기준이 있는 행동 하나를 정해요. 선택만으로 실제 잔액이나 성과가 바뀌지는 않습니다.</p>
 <ul>{sim.levers.map(l=><li key={l.id}>{l.name}: {l.options.find(o=>o.key===picksOf(s)[l.id])?.label}</li>)}</ul>
 {simRequires(sim,picksOf(s)).map(r=><div key={r.lever}><b>{r.lever}의 전제</b><ul>{r.items.map((x,i)=><li key={i}>{x}</li>)}</ul></div>)}
 <p className="notice">{projectCash(sim,picksOf(s)).timeBlocked?'시간이 부족한 달이 있어 채택할 수 없어요.':projectCash(sim,picksOf(s)).freeHours===null?'가용시간을 입력한 뒤 채택해 주세요.':'월별 시간 합계는 범위 안입니다. 일정 충돌과 전제 조건은 직접 확인해 주세요.'} 현금 부족 예상: {projectCash(sim,picksOf(s)).zeroMonth??'기간 내 월말 음수 없음'}.</p>
 <form onSubmit={form(f=>run(w=>adoptScenario(w,{title:str(f,'title'),goal:str(f,'goal'),reviewDate:str(f,'reviewDate'),action:str(f,'action'),criterion:str(f,'criterion'),minutes:num(f,'minutes'),assumptions:str(f,'assumptions')})))}>
 <Field label="이번 결정"><input name="title" required maxLength={200} placeholder="예: 이직 준비를 병행하는 방법"/></Field>
 <Field label="원하는 결과와 확인 기준"><input name="goal" required maxLength={200} placeholder="예: 지원 가능한 공고 3개와 부족한 역량 정리"/></Field>
 <Field label="이번 주 행동 하나"><input name="action" required maxLength={200}/></Field>
 <Field label="행동 완료 기준"><input name="criterion" required maxLength={2000}/></Field>
 <div className="form-grid"><Field label="행동 예상 시간 (분)"><input name="minutes" type="number" required min="1" max="10000" defaultValue="30"/></Field><Field label="재검토 날짜"><input name="reviewDate" type="date" required min={today()} defaultValue={today()}/></Field></div>
 <Field label="지킬 조건·포기할 것·아직 모르는 것"><textarea name="assumptions" required maxLength={4000}/></Field>
 <label className="planning-check"><input type="checkbox" required/>시간의 중복 배정, 절감액 중복, 필수 의무와 실행 전제를 확인했어요.</label>
 <button className="primary">현재 조합을 실행 계획으로 채택</button></form></> }</section></>}
 <section className="panel"><h2>4. 행동과 실제 결과</h2>
 <div className="button-row"><button className="secondary" onClick={()=>onQuest()}>행동 추가</button><button className="secondary" onClick={onReview}>주간 회고 작성</button></div>
 {!s.quests.length&&<p>계획을 채택하면 첫 행동이 여기에 연결됩니다.</p>}
 {s.quests.filter(q=>q.status!=='done').slice(0,10).map(q=><div className="planning-action" key={q.id}><div><b>{q.title}</b><p>{q.criterion}</p><small>{q.due} · {q.minutes}분 · {q.status==='paused'?'보류':'예정'}</small></div><div className="button-row"><button className="secondary" onClick={()=>onQuest(q.id)}>실행 결과</button><button className="text-button" onClick={()=>onEdit(q.id)}>수정·보류</button></div></div>)}
 {s.decisions.map(d=>{const projection=projectCash(d.sim,d.picks),action=s.quests.find(q=>q.id===d.actionId),r=d.review;const predicted=r?.actualMonth?projection.rows.find(x=>x.month===r.actualMonth)?.cash:undefined;
 return <article className="decision-card" key={d.id}><h3>{d.title} · {d.status==='active'?'진행 중':'검토 완료'}</h3><p>목표: {d.goal}</p><p>재검토: {d.reviewDate} · 기준일: {d.sim.asOf}</p><p>조건: {d.assumptions}</p><p>연결 행동: {action?.title??'삭제된 행동'} · {action?.status==='done'?action.outcome==='full'?'완료':action.outcome==='partial'?'일부 실행':'미실행':action?.status==='paused'?'보류':'예정'}</p>
 {action&&<button className="secondary" onClick={()=>onQuest(action.id)}>{action.status==='done'?'완료 취소':'실행 결과 기록'}</button>}
 <details><summary>채택 당시 가정과 예측 보기</summary><p>기준 현금 {won(d.sim.cash)} · 기준 월수지 {won(d.sim.netMonthly)} · {d.sim.flowBasis}</p><ul>{d.sim.levers.map(l=><li key={l.id}>{l.name}: {l.options.find(o=>o.key===d.picks[l.id])?.label}</li>)}</ul><div className="planning-table"><table><thead><tr><th>월</th><th>예상 월말 잔액</th><th>하루 여유시간</th></tr></thead><tbody>{projection.rows.map((x,i)=><tr key={x.month}><td>{x.month}</td><td>{won(x.cash)}</td><td>{projection.timeRows[i].freeHours??'미확인'}</td></tr>)}</tbody></table></div></details>
 {r?<><p>장애물: {obstacles[r.obstacle]} · {r.note}</p><p>다음 판단: {r.next}</p>{r.actualCash!==null&&predicted!==undefined&&<p>{r.actualMonth} 월말 · 예상 {won(predicted)} / 실제 {won(r.actualCash)} / 차이 {won(r.actualCash-predicted)}</p>}</>:<form onSubmit={form(f=>run(w=>reviewDecision(w,d.id,{at:today(),actualCash:nullable(f,'actualCash'),actualMonth:str(f,'actualMonth')||null,obstacle:str(f,'obstacle') as keyof typeof obstacles,note:str(f,'note'),next:str(f,'next')})))}>
 <Field label="가장 큰 장애물"><select name="obstacle">{Object.entries(obstacles).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
 <Field label="실제 결과와 달랐던 이유"><textarea name="note" required maxLength={4000}/></Field>
 <div className="form-grid"><Field label="비교할 월말 (선택)"><select name="actualMonth"><option value="">월말 비교 생략</option>{projection.rows.filter(x=>x.month<today().slice(0,7)).map(x=><option key={x.month}>{x.month}</option>)}</select></Field><Field label="그달 실제 월말 잔액 (모르면 비워 두기)"><input name="actualCash" type="number"/></Field></div>
 <Field label="다음 판단: 유지·축소·교체와 구체적 행동"><input name="next" required maxLength={200}/></Field><button className="primary">검토 저장</button></form>}
 </article>})}
 {s.reviews.slice(0,5).map(r=><article key={r.id} className="decision-card"><h3>{r.date} 주간 회고</h3><p>{r.win}</p><p>장애물: {r.obstacle}</p><p>다음: {r.next}</p></article>)}
 {s.quests.some(q=>q.status==='done')&&<details><summary>최근 행동 결과</summary>{s.quests.filter(q=>q.status==='done').sort((a,b)=>(b.completedAt??'').localeCompare(a.completedAt??'')).slice(0,10).map(q=><div className="planning-action" key={q.id}><p>{q.title} · {q.outcome==='full'?'완료':q.outcome==='partial'?'일부 실행':'미실행'}</p><button className="text-button" onClick={()=>{if(confirm('이 행동의 완료 기록을 취소할까요?'))onQuest(q.id);}}>완료 취소</button></div>)}</details>}
 </section></fieldset></div>;
}
const obstacles={none:'없음',time:'시간 부족',method:'방법이 불명확',waiting:'외부 대기',priority:'우선순위 변화',condition:'컨디션',other:'기타'};
function LeverForm({lever,onSave}:{lever?:Lever;onSave:(l:Lever)=>void}){
 const [error,setError]=useState('');
 const options=lever?.options??[{key:'A',label:'바꾸는 경우',delta:0,hours:0,requires:[]},{key:'B',label:'다른 대안',delta:0,hours:0,requires:[]},{key:'C',label:'현재 유지',delta:0,hours:0,requires:[]}];
 return <form key={JSON.stringify(lever)} onSubmit={e=>{e.preventDefault();try{const f=new FormData(e.currentTarget);const v=leverSchema.parse({id:lever?.id??uid(),name:str(f,'name'),starts:str(f,'starts'),basis:str(f,'basis'),group:lever?.group??'',options:options.map((o,i)=>({key:o.key,label:str(f,`label${i}`),delta:num(f,`delta${i}`),hours:num(f,`hours${i}`),requires:str(f,`req${i}`).split('\n').map(x=>x.trim()).filter(Boolean)}))});if(!v.options.some(o=>o.delta===0&&o.hours===0))throw Error('현상 유지 비교를 위해 돈과 시간 증감이 모두 0인 선택을 하나 남겨 주세요.');onSave(v);setError('');}catch(e){setError(e instanceof Error?e.message:'입력을 확인해 주세요.');}}}>
 {error&&<p role="alert">{error}</p>}<Field label="선택 항목 이름"><input name="name" required maxLength={200} defaultValue={lever?.name}/></Field><Field label="효과 시작월"><input name="starts" type="month" required defaultValue={lever?.starts??monthAdd(today().slice(0,7),1)}/></Field><Field label="증감액의 근거"><textarea name="basis" required maxLength={2000} defaultValue={lever?.basis}/></Field>
 {options.map((o,i)=><fieldset key={o.key}><legend>선택 {o.key}</legend><Field label={`선택 ${o.key} 이름`}><input name={`label${i}`} required maxLength={200} defaultValue={o.label}/></Field><div className="form-grid"><Field label={`선택 ${o.key} 월 현금 증감 (원)`}><input name={`delta${i}`} type="number" required defaultValue={o.delta}/></Field><Field label={`선택 ${o.key} 하루 여유시간 증감`}><input name={`hours${i}`} type="number" required step="0.1" min="-24" max="24" defaultValue={o.hours}/></Field></div><Field label={`선택 ${o.key} 실행 전제 (줄마다 하나)`}><textarea name={`req${i}`} defaultValue={o.requires.join('\n')} maxLength={3000}/></Field></fieldset>)}
 <p className="small-note">시간을 사용하는 선택은 음수, 확보하는 선택은 양수로 입력해요. A/B/C는 난이도 순서가 아닙니다.</p><button className="secondary">선택 항목 저장</button></form>;
}
