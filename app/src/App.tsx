import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, BriefcaseBusiness, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleHelp, Cloud, CloudOff, Compass, Flag, Gift, Heart, Home, Leaf, ListChecks, LockKeyhole, Map, Menu, MoreHorizontal, Plus, RefreshCw, Settings, Sparkles, Sprout, Target, Trash2, TrendingUp, Trophy, Swords, Zap, Wallet, X } from 'lucide-react';
import { upsertJournal, journalOf, journalStreak, projectCash, simRequires, defaultPicks, monthAdd, type Sim, compareWorkspaces, OBS_GROUPS, OBS_UNIT, checkObservation, obsText, statList, combatPower, powerDiff, questQueue, focusQuest, subQuestFor, acceptSubQuest, OUTCOME, OBS_NAME, weekStats, nextSuggestion, accuracy, pokerNet, rewardProgress, evaluateTriggers, ruleText, type TriggerRule, type Outcome, assessBranch, completeQuest, createEmpty, latest, level, log, parseBackup, reserveReward, rewardAvailable, today, uid, won, xpOf, type Plan, type Quest, type Workspace } from './model';
import { AuthGate, NewPassword } from './Auth';
import { useWorkspace } from './store';

type View='sim'|'journal'|'settings';
type Dialog={type:'outcome';item:Quest}|{type:'quest';item?:Quest}|{type:'plan';item?:Plan}|{type:'observation'}|{type:'reward'}|{type:'domain'}|{type:'review'}|{type:'import';data:Workspace}|null;
const nav=[{id:'sim',label:'시뮬레이션',short:'예측',icon:TrendingUp},{id:'journal',label:'일기',short:'일기',icon:BookOpen}] as const;
const icons={wallet:Wallet,sprout:Sprout,briefcase:BriefcaseBusiness,book:BookOpen,heart:Heart,sparkles:Sparkles};
const kindNames=OBS_NAME;   // 이름표 정본은 model.ts 하나다
const text=(f:FormData,k:string)=>String(f.get(k)??'').trim();
const num=(f:FormData,k:string)=>{const n=Number(f.get(k));if(!Number.isFinite(n)||n<0)throw Error('올바른 숫자를 입력해 주세요.');return n;};

function Badge({children,color='sage'}:{children:ReactNode;color?:string}){return <span className={`badge ${color}`}>{children}</span>;}
function DomainIcon({domain,size=20}:{domain:Workspace['domains'][number];size?:number}){const Icon=icons[domain.icon];return <span className={`domain-icon ${domain.color}`}><Icon size={size}/></span>;}
function Empty({title,body,action}:{title:string;body:string;action?:ReactNode}){return <div className="empty"><Sprout size={32}/><h3>{title}</h3><p>{body}</p>{action}</div>;}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20}/></button></div>{children}</dialog>;}

function SimChart({sim,picks}:{sim:Sim;picks:Record<string,string>}){
 const box=useRef<HTMLDivElement>(null);const [w,setW]=useState(660);
 useEffect(()=>{const el=box.current;if(!el)return;
  const ro=new ResizeObserver(e=>setW(Math.max(260,Math.round(e[0].contentRect.width))));
  ro.observe(el);return()=>ro.disconnect();},[]);
 const h=196,PL=6,PR=6,PT=16,PB=24;
 const mine=projectCash(sim,picks).rows, none=projectCash(sim,defaultPicks(sim)).rows;
 const vals=[sim.cash,0,...mine.map(r=>r.cash),...none.map(r=>r.cash)];
 const max=Math.max(...vals),min=Math.min(...vals),span=(max-min)||1;
 const X=(i:number)=>PL+(i/sim.months)*(w-PL-PR);
 const Y=(v:number)=>PT+(1-(v-min)/span)*(h-PT-PB);
 const path=(rows:typeof mine)=>`M${X(0)},${Y(sim.cash)}`+rows.map((r,i)=>` L${X(i+1)},${Y(r.cash)}`).join('');
 const step=sim.months>6?2:1;
 return <div className="sim-chart" ref={box}>
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
       aria-label={`${sim.months}달 현금 예측. 고른 조합은 ${Math.round(mine[mine.length-1].cash).toLocaleString('ko-KR')}원`}>
   <line className="sim-zero" x1={PL} x2={w-PR} y1={Y(0)} y2={Y(0)}/>
   <text className="sim-zero-label" x={PL+2} y={Y(0)-5}>0원</text>
   <path className="sim-line-none" d={path(none)} fill="none"/>
   <path className="sim-line-mine" d={path(mine)} fill="none"/>
   {mine.map((r,i)=><circle key={r.month} className="sim-dot" cx={X(i+1)} cy={Y(r.cash)} r={i===mine.length-1?4:2.5}/>)}
   {mine.filter((_,i)=>i%step===0||i===mine.length-1).map((r)=>{
     const i=mine.indexOf(r);return <text key={r.month} className="sim-x" x={X(i+1)} y={h-7} textAnchor="middle">{r.month.slice(5)}월</text>;})}
  </svg>
  <div className="sim-legend"><span className="mine">고른 조합</span><span className="none">아무것도 안 하면</span></div>
 </div>;
}

function Landscape(){return <svg className="landscape" viewBox="0 0 400 230" fill="none" aria-hidden="true"><circle cx="302" cy="61" r="31" fill="#e7e9cb"/><path d="M21 168C74 111 125 112 181 149C249 70 310 82 396 151V230H21Z" fill="#dfe8d8"/><path d="M0 199C79 153 138 159 205 184C281 134 341 157 400 184V230H0Z" fill="#c4d5b9"/><path d="M168 230C184 197 250 206 227 177C214 161 231 143 258 140" stroke="#fafaf0" strokeWidth="17" strokeLinecap="round"/><path d="M69 197V128M69 165L47 144M69 153L88 134" stroke="#718d67" strokeWidth="5" strokeLinecap="round"/><ellipse cx="69" cy="120" rx="31" ry="38" fill="#92af81"/><ellipse cx="50" cy="139" rx="21" ry="26" fill="#9dbb8b"/><ellipse cx="88" cy="132" rx="20" ry="27" fill="#88a776"/><path d="M328 201V158" stroke="#718d67" strokeWidth="4"/><path d="M328 116L299 167H357L328 116Z" fill="#a6bd94"/><path d="M328 137L304 178H352L328 137Z" fill="#8fa97e"/><circle cx="258" cy="138" r="12" fill="#fff"/><circle cx="258" cy="138" r="5" fill="#6f8b62"/><path d="M258 125V99L282 105L258 113" stroke="#6a855f" strokeWidth="3" strokeLinejoin="round"/><path d="M124 82L130 79L136 82M169 56L175 53L181 56" stroke="#a2b29a" strokeWidth="2" strokeLinecap="round"/><circle cx="136" cy="192" r="3" fill="#f6f6dd"/><circle cx="292" cy="207" r="3" fill="#f6f6dd"/></svg>;}

// 폼 값 → 전환 규칙. 종류를 고르지 않으면 null 이고, 그러면 문장만 남는다.
function buildRule(f:FormData,key:string):TriggerRule|null{
 const g=(n:string)=>String(f.get(`${n}${key}`)??'').trim();
 const n=(x:string)=>Number(g(x))||0;
 const when=g('ruleWhen'); if(!when)return null;
 const to=(g('ruleTo')||'C') as 'A'|'B'|'C';
 if(when==='outcomes')return {when,recent:Math.max(1,n('ruleN')),weak:Math.max(1,n('ruleM')),to};
 if(when==='streak')return {when,full:Math.max(1,n('ruleN')),to};
 if(when==='idle')return {when,days:Math.max(1,n('ruleN')),to};
 return {when:'observation',kind:(g('ruleKind')||'hours') as keyof typeof OBS_NAME,op:(g('ruleOp')||'lt') as 'lt'|'gt',value:n('ruleN'),to};
}

export default function App(){
 const store=useWorkspace();const {data:s,demo,ready}=store;
 const [view,setView]=useState<View>('sim'),[menu,setMenu]=useState(false),[dialog,setDialog]=useState<Dialog>(null),[toast,setToast]=useState(''),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[selectedDomain,setSelectedDomain]=useState('finance'),[gate,setGate]=useState(()=>localStorage.getItem('life:gate')),[planFilter,setPlanFilter]=useState('all'),[planQuery,setPlanQuery]=useState(''),[openPlans,setOpenPlans]=useState<string[]>([]),[suggestion,setSuggestion]=useState<{text:string;switchTo?:'A'|'B'|'C';planId?:string}|null>(null),[authEmail,setAuthEmail]=useState(''),[authPassword,setAuthPassword]=useState(''),[authMode,setAuthMode]=useState<'login'|'signup'>('login'),[authSent,setAuthSent]=useState(false),[simPlan,setSimPlan]=useState(''),[simCash,setSimCash]=useState(''),[simHours,setSimHours]=useState(''),[simOpen,setSimOpen]=useState(false),[levelUp,setLevelUp]=useState<ReturnType<typeof powerDiff>|null>(null),[picks,setPicks]=useState<Record<string,string>>({});
 const importRef=useRef<HTMLInputElement>(null);
 const xp=xpOf(s),done=s.quests.filter(q=>q.status==='done'),open=s.quests.filter(q=>q.status==='ready').sort((a,b)=>a.due.localeCompare(b.due)),todayQs=open.filter(q=>q.due<=today()).slice(0,3),actualToday=done.filter(q=>q.completedAt?.slice(0,10)===today()).length;
 const queue=questQueue(s),fq=queue[0]??null,upNext=queue[1]??null,bonus=subQuestFor(s),power=combatPower(s);
 const activeDomain=s.domains.find(d=>d.id===selectedDomain)??s.domains[0];const currentLevel=level(xpOf(s,activeDomain.id));
 const notify=(msg:string)=>setToast(msg);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(timer);},[toast]);
 const go=(v:View)=>{setView(v);setMenu(false);setFilter('all');setQuery('');window.scrollTo({top:0,behavior:'instant'});};
 const change=(fn:(s:Workspace)=>Workspace,msg?:string)=>{try{store.update(fn);if(msg)notify(msg);}catch(e){notify((e as Error).message);}};
 const toggle=(q:Quest)=>{
  if(q.status==='done'){change(s=>completeQuest(s,q.id),'완료를 취소했어요.');return;}
  setDialog({type:'outcome',item:q});   // 끝까지 / 절반 / 못 함 — 결과를 받고 나서 기록한다
 };
 function finishQuest(q:Quest,outcome:Outcome){
  const gained=Math.round(q.xp*OUTCOME[outcome].ratio);
  // 다음 상태를 **여기서 직접 계산**한다. setTimeout 으로 store 를 다시 읽으면
  // 저장이 늦을 때 레벨업 연출이 조용히 사라진다(실제로 e2e 에서 그렇게 놓쳤다).
  const before=store.data;
  let after:Workspace;
  try{after=completeQuest(before,q.id,outcome);}catch(e){notify((e as Error).message);return;}
  const diff=powerDiff(before,after);
  change(()=>after,`${OUTCOME[outcome].label} · +${gained} XP`);
  setDialog(null);
  if(diff.ups.length)setLevelUp(diff);         // 세진 순간을 보여준다. 숫자가 점프한다
  const next=nextSuggestion(after,q.id);if(next)setSuggestion(next);
 }
 const exportBackup=()=>{const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`life-${demo?'demo-':''}${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('백업 파일을 내려받았어요. 개인 기록이 포함될 수 있습니다.');};
 async function importFile(file?:File){if(!file)return;try{if(file.size>4000000)throw Error('4MB 이하의 LIFE 앱 백업 파일을 선택해 주세요.');setDialog({type:'import',data:parseBackup(JSON.parse(await file.text()))});}catch{notify('올바른 LIFE 앱 백업 형식이 아닙니다. 기존 데이터는 유지됩니다.');}if(importRef.current)importRef.current.value='';}
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{if(!dialog)return;
 if(dialog.type==='quest'){const q:Quest={id:dialog.item?.id??uid(),title:text(f,'title'),domainId:text(f,'domain'),minutes:num(f,'minutes'),xp:num(f,'xp'),due:text(f,'due'),criterion:text(f,'criterion'),partialCriterion:text(f,'partialCriterion'),minimumCriterion:text(f,'minimumCriterion'),planId:text(f,'plan'),repeat:(text(f,'repeat')||'none') as 'none'|'daily'|'weekly'|'monthly',status:dialog.item?.status??'ready',completedAt:dialog.item?.completedAt??null,outcome:dialog.item?.outcome??null};store.update(s=>log({...s,quests:dialog.item?s.quests.map(x=>x.id===q.id?q:x):[q,...s.quests]},`${q.title} · ${dialog.item?'수정':'추가'}`));}
 if(dialog.type==='plan'){const p:Plan={id:dialog.item?.id??uid(),title:text(f,'title'),goal:text(f,'goal'),domainId:text(f,'domain'),active:dialog.item?.active??'A',branches:(['A','B','C'] as const).map(key=>({key,title:text(f,`title${key}`),cost:num(f,`cost${key}`),hours:num(f,`hours${key}`),duration:num(f,`duration${key}`),result:text(f,`result${key}`),trigger:text(f,`trigger${key}`),rule:buildRule(f,key),switchCost:num(f,`switch${key}`)}))};store.update(s=>log({...s,plans:dialog.item?s.plans.map(x=>x.id===p.id?p:x):[p,...s.plans]},`${p.title} · 플랜 저장`));}
 if(dialog.type==='observation'){const o={id:uid(),kind:text(f,'kind') as keyof typeof kindNames,value:num(f,'value'),date:text(f,'date'),note:text(f,'note')};const bad=checkObservation(o.kind,o.value);if(bad)throw Error(bad);store.update(s=>log({...s,observations:[o,...s.observations]},`${kindNames[o.kind]} 기록 추가`));}
 if(dialog.type==='reward')store.update(s=>({...s,rewards:[{id:uid(),title:text(f,'title'),type:text(f,'type') as 'real'|'digital',cost:num(f,'cost'),requiredXp:num(f,'requiredXp'),domainId:text(f,'rewardDomain'),note:text(f,'note'),status:'wish',spent:null,usedAt:null,reservedAt:null},...s.rewards]}));
 if(dialog.type==='domain')store.update(s=>({...s,domains:[...s.domains,{id:uid(),name:text(f,'name'),color:text(f,'color') as 'sage',icon:text(f,'icon') as 'wallet'}]}));
 if(dialog.type==='review')store.update(s=>log({...s,reviews:[{id:uid(),date:today(),win:text(f,'win'),obstacle:text(f,'obstacle'),next:text(f,'next'),stats:weekStats(s)},...s.reviews]},'주간 회고를 남겼어요'));
 setDialog(null);notify('저장했어요. 다음 한 걸음도 나의 속도로.');}catch(e){notify((e as Error).message);}}
 const domainSelect=(value?:string)=><select name="domain" defaultValue={value??s.domains[0].id}>{s.domains.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>;
 function questRow(q:Quest){const d=s.domains.find(x=>x.id===q.domainId)!;return <div key={q.id} className={`quest-row ${q.status==='done'?'is-done':''}`}><button className="check-button" aria-label={`${q.title} ${q.status==='done'?'완료 취소':'완료'}`} onClick={()=>toggle(q)} disabled={!ready}>{q.status==='done'?<Check size={16}/>:null}</button><button className="quest-content" onClick={()=>setDialog({type:'quest',item:q})}><strong>{q.title}</strong><span><i className={`dot ${d.color}`}/>{d.name}<b>·</b>{q.minutes}분{q.due<today()&&q.status==='ready'&&<em>일정 다시 보기</em>}</span></button>{q.repeat!=='none'&&<span className="repeat-chip"><RefreshCw size={11}/>{q.repeat==='daily'?'매일':q.repeat==='weekly'?'매주':'매달'}</span>}{q.status==='done'&&q.outcome&&q.outcome!=='full'&&<span className={`outcome-chip ${q.outcome}`}>{q.outcome==='partial'?'절반':'못 함'}</span>}<span className="xp-pill">{q.status==='done'&&q.outcome?`+${Math.round(q.xp*OUTCOME[q.outcome].ratio)}`:`+${q.xp}`} <small>XP</small></span><button className="icon-button" aria-label={`${q.title} 편집`} onClick={()=>setDialog({type:'quest',item:q})}><MoreHorizontal size={18}/></button></div>;}
 const sectionHead=(eyebrow:string,title:string,desc:string,action?:ReactNode)=><div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>;
  const headAction=<button className="primary" onClick={()=>setDialog({type:'observation'})}><Plus size={17}/>빠른 기록</button>;

 // 플랜 목록 — 필터·검색을 거치고 **신호가 있는 것이 위로** 온다.
 const planHasSignal=(p:Plan)=>evaluateTriggers(s,p).length>0;
 const visiblePlans=(()=>{const q=planQuery.trim();
  return s.plans
   .filter(p=>planFilter==='all'?true:planFilter==='signal'?planHasSignal(p):p.domainId===planFilter)
   .filter(p=>!q||p.title.includes(q)||p.goal.includes(q)||p.branches.some(b=>b.title.includes(q)))
   .sort((a,b)=>Number(planHasSignal(b))-Number(planHasSignal(a)));})();

 // 목록이 짧으면 굳이 접지 않는다(필터로 좁혔을 때 포함). 직접 펼쳤거나 신호가 있어도 펼친다.
 const planOpen=(p:Plan)=>visiblePlans.length<=2||openPlans.includes(p.id)||planHasSignal(p);

 // 메인에 들어가기 전에 로그인 화면을 먼저 보여준다. 로그인 여부를 화면으로 알 수 있어야 한다는 요청(2026-11-02).
 if(store.recovery) return <NewPassword store={store}/>;
 if(!store.user&&!gate) return <AuthGate store={store}
   onDemo={()=>{localStorage.setItem('life:gate','demo');setGate('demo');store.viewDemo();}}
   onGuest={()=>{localStorage.setItem('life:gate','local');setGate('local');store.startPersonal();}}/>;
 return <div className="app-shell">
 {menu&&<button className="sidebar-scrim" onClick={()=>setMenu(false)} aria-label="메뉴 닫기"/>}
 <aside className={`sidebar ${menu?'open':''}`}><button className="brand" onClick={()=>go('sim')}><span className="brand-mark"><Sprout size={24}/></span><span>LIFE<span className="brand-sub">YOUR LIFE, IN PROGRESS</span></span></button>
 <div className="workspace-switch"><span className="avatar">L</span><div><strong>{s.name}</strong><small>나만의 라이프 워크스페이스</small></div><ChevronDown size={15}/></div>
 <div className="nav-caption">MY WORKSPACE</div><nav>{nav.map(n=><button key={n.id} className={view===n.id?'active':''} onClick={()=>go(n.id)}><n.icon size={19}/><span>{n.label}</span>{n.id==='journal'&&journalStreak(s)>0&&<small>{journalStreak(s)}일</small>}</button>)}</nav>
 <div className="sidebar-note"><div><Leaf size={17}/><span>작은 걸음도, 앞으로.</span></div><p>오늘의 나에게 맞는<br/>속도로 걸어가면 돼요.</p><svg viewBox="0 0 160 38" aria-hidden="true"><path d="M0 35Q30 0 60 25T120 17T160 8" fill="none" stroke="#b6c8a6" strokeWidth="2" strokeDasharray="4 5"/><circle cx="120" cy="17" r="4" fill="#799063"/></svg></div>
 <div className="sidebar-bottom"><button className={view==='settings'?'active':''} onClick={()=>go('settings')}><Settings size={18}/>설정과 동기화</button><div className={`profile ${store.user?'signed-in':'signed-out'}`}><div className="profile-avatar">{store.user?<Check size={15}/>:'나'}</div><div className="profile-id"><strong>{store.user?store.user.email:demo?'예시 공간':'로그인 안 됨'}</strong><small>{demo?'둘러보는 중 · 저장되지 않아요':store.user?'모든 기기에서 이어져요':'이 기기에만 저장 중'}</small></div>{!store.user&&<button className="profile-login" onClick={()=>{localStorage.removeItem('life:gate');setGate(null);}}>로그인</button>}<button className="icon-button" onClick={()=>go('settings')} aria-label="계정 설정"><MoreHorizontal size={18}/></button></div></div></aside>
 <div className="main-wrap"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={()=>setMenu(true)} aria-label="메뉴 열기"><Menu size={21}/></button><span>나의 워크스페이스</span><ChevronRight size={14}/><strong>{nav.find(n=>n.id===view)?.label??'설정'}</strong></div><div className="top-actions"><button className="sync-status" onClick={()=>go('settings')}>{store.user&&!demo?<Cloud size={15}/>:<CloudOff size={15}/>}<span>{store.status}</span></button><span className="top-divider"/><button className="icon-button" onClick={()=>go('settings')} aria-label="도움말과 백업"><CircleHelp size={18}/></button></div></header>
 <main>
 {demo&&<div className="demo-banner"><span><Sparkles size={15}/>가상 데이터로 둘러보는 공간이에요. 자유롭게 눌러보세요.</span><button onClick={()=>{store.startPersonal();notify('빈 개인 공간을 준비했어요. 첫 퀘스트를 만들어 보세요.');}}>내 공간 시작하기<ArrowRight size={14}/></button></div>}
 {store.error&&<div className="error-banner" role="alert"><span>{store.error}</span><button onClick={()=>store.setError('')} aria-label="알림 닫기"><X size={17}/></button></div>}
 {!ready&&<p role="status">기록을 불러오고 있어요…</p>}
 {view==='journal'&&(()=>{const d=today();const mine=journalOf(s,d);const streak=journalStreak(s);
 return <>{sectionHead('ONE A DAY','일기',streak>0?`${streak}일 연속으로 쓰고 있어요.`:'오늘 하루를 한 단락으로 남겨요.')}
 <section className="panel journal-today">
  <div className="panel-heading"><div><h2>{d}</h2><p>{mine?'이미 쓴 글이에요. 고치면 덮어써요.':'하루에 한 번이면 충분해요.'}</p></div>
   {streak>0&&<Badge>{streak}일째</Badge>}</div>
  <form className="journal-form" onSubmit={e=>{e.preventDefault();
    const f=new FormData(e.currentTarget);const t=String(f.get('text')??'');
    const m=String(f.get('mood')??'');
    change(w=>upsertJournal(w,d,t,m?Number(m):null),t.trim()?'일기를 남겼어요.':'오늘 일기를 비웠어요.');}}>
   <label className="sr-only" htmlFor="journal-text">오늘의 일기</label>
   <textarea id="journal-text" name="text" key={mine?.updatedAt??d} defaultValue={mine?.text??''}
     maxLength={20000} rows={9} placeholder="오늘 어땠나요. 잘 안 된 날도 그대로 적어도 돼요."/>
   <div className="journal-actions">
    <label className="journal-mood"><span>오늘 컨디션</span>
     <select name="mood" key={'m'+(mine?.updatedAt??d)} defaultValue={mine?.mood??''}>
      <option value="">안 적음</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <button className="primary" disabled={!ready}>저장</button>
   </div>
  </form>
 </section>
 <section className="panel"><div className="panel-heading"><div><h2>지난 일기</h2>
   <p>{s.journal.length?`${s.journal.length}개`:'아직 없어요.'}</p></div><BookOpen size={18}/></div>
  {s.journal.filter(x=>x.date!==d).slice(0,60).map(x=><article className="journal-past" key={x.id}>
    <div className="journal-past-top"><strong>{x.date}</strong>{x.mood?<span className="journal-mood-chip">컨디션 {x.mood}</span>:null}</div>
    <p>{x.text}</p></article>)}
  {!s.journal.filter(x=>x.date!==d).length&&<Empty title="여기가 쌓여요" body="하루 한 단락이면 돼요. 며칠 모이면 시뮬레이션 숫자와 같이 읽을 수 있어요."/>}
 </section></>;})()}
 {view==='sim'&&(()=>{const sim=s.sim;
 if(!sim)return <>{sectionHead('WHAT IF','시뮬레이션','아직 예측 자료가 없어요.')}<Empty title="예측 자료가 없어요" body="설정과 동기화 → 백업 가져오기 로 최신 파일을 한 번 더 가져오면 채워져요. 예시 공간에서는 바로 만져볼 수 있어요." action={<button className="secondary" onClick={()=>go('settings')}>설정과 동기화 열기<ArrowRight size={15}/></button>}/></>;
 const P=Object.keys(picks).length?picks:defaultPicks(sim);
 const r=projectCash(sim,P), none=projectCash(sim,defaultPicks(sim));
 const best=Object.fromEntries(sim.levers.map(l=>[l.id,l.options.reduce((a,b)=>b.delta>a.delta?b:a).key]));
 const reqs=simRequires(sim,P);
 const set=(id:string,key:string)=>setPicks({...P,[id]:key});
 return <>{sectionHead('WHAT IF','앞으로 '+sim.months+'달','손잡이를 바꾸면 선이 움직여요. 고르는 건 나예요.',
   <button className="secondary" onClick={()=>setPicks(best)}>최선으로 맞추기</button>)}
 <section className="panel sim-panel">
  <div className="sim-head">
   <div><span className="eyebrow">{r.zeroMonth?'현금이 0 아래로':'버틴다'}</span>
    <b className={r.zeroMonth?'bad':'good'}>{r.zeroMonth?r.zeroMonth:'안 간다'}</b></div>
   <div><span className="eyebrow">{monthAdd(sim.startMonth,sim.months-1)} 현금</span>
    <b className={r.endCash<0?'bad':'good'}>{won(Math.round(r.endCash))}</b></div>
   <div><span className="eyebrow">마지막 달 수지</span><b>{won(Math.round(r.monthlyFlow))}</b></div>
  </div>
  <SimChart sim={sim} picks={P}/>
  <p className="sim-basis">지금 현금 {won(sim.cash)} ({sim.asOf}) · 손대지 않으면 매달 {won(sim.netMonthly)}<br/>{sim.flowBasis}</p>
 </section>
 <section className="panel sim-levers"><div className="panel-heading"><div><h2>손잡이</h2><p>눌러서 바꿔 보세요. 숫자와 선이 바로 따라와요.</p></div>
  <button className="text-button" onClick={()=>setPicks(defaultPicks(sim))}>되돌리기</button></div>
  {(()=>{const gs=sim.groups.length?sim.groups:[{key:'',name:'',note:''}];
   return gs.map(g=>{const mine=sim.levers.filter(l=>(l.group||'')===g.key);
    if(!mine.length)return null;
    const pulled=mine.filter(l=>{const o=l.options.find(x=>x.key===(P[l.id]??defaultPicks(sim)[l.id]));return o&&o.delta!==0;}).length;
    return <div className="sim-group" key={g.key||'all'}>
     {g.name&&<div className="sim-group-head"><h3>{g.name}</h3>{g.note&&<p>{g.note}</p>}
       <span className="sim-group-count">{pulled}/{mine.length}</span></div>}
     {mine.map(lv=><div className="sim-lever" key={lv.id}>
      <div className="sim-lever-top"><strong>{lv.name}</strong><small>{lv.starts} 부터</small></div>
      <div className="sim-options">{lv.options.map(o=>
        <button key={o.key} className={(P[lv.id]??defaultPicks(sim)[lv.id])===o.key?'active':''}
          onClick={()=>set(lv.id,o.key)}>{o.label}
          {o.delta?<em className={o.delta<0?'minus':''}>{o.delta>0?'+':'−'}{won(Math.abs(o.delta))}</em>:null}</button>)}</div>
      {lv.basis&&<p className="sim-basis-small">{lv.basis}</p>}
     </div>)}
    </div>;});})()}
 </section>
 {r.needPerMonth>0&&<section className="panel sim-target"><div className="panel-heading"><h2>그래도 모자란 만큼</h2><Target size={18}/></div>
  <p>이 조합으로도 매달 <b>{won(r.needPerMonth)}</b> 이 모자라요.
  {sim.incomeNow?<> 지금 세후 {won(sim.incomeNow)} 이니까 <b>세후 월 {won(sim.incomeNow+r.needPerMonth)}</b> 이면 수지가 맞아요.</>:null}</p>
  <p className="small-note">받을 것 같은 금액이 아니라 <b>맞추려면 필요한 금액</b>이에요. 모자란 만큼은 다른 손잡이로 메우거나 적자로 남아요.</p></section>}
 <section className="panel"><div className="panel-heading"><div><h2>이 조합이 성립하려면</h2><p>고른 손잡이가 요구하는 것들이에요.</p></div><ListChecks size={18}/></div>
  {reqs.length?reqs.map(q=><div className="sim-req" key={q.lever}><strong>{q.lever}</strong><span>{q.option}</span>
    <ul>{q.items.map(it=><li key={it}>{it}</li>)}</ul></div>)
   :<Empty title="아직 아무 손잡이도 안 당겼어요" body={`이대로면 ${monthAdd(sim.startMonth,sim.months-1)} 에 ${won(Math.round(none.endCash))} 이에요. 위에서 하나씩 눌러 보세요.`}/>}
 </section></>;})()}
 {view==='settings'&&<>{sectionHead('YOUR SPACE','설정과 동기화','내 기록을 안전하게 보관하고, 다른 기기에서도 이어가요.')}<div className="settings-grid"><section className="panel settings-panel"><h2><Cloud size={20}/>휴대폰 · PC 연결</h2><p>같은 계정으로 로그인하면 개인 공간이 자동으로 동기화돼요.</p>{!store.config&&<div className="notice">아직 클라우드 저장소가 연결되지 않았어요. 지금 기록은 이 기기에만 저장됩니다.</div>}{store.user?<><Badge>{store.user.email}</Badge><p>상태: {store.status}</p><div className="button-row"><button className="primary" onClick={()=>void store.sync()}>지금 동기화</button><button className="secondary" onClick={()=>store.logout().then(()=>{localStorage.removeItem('life:gate');setGate(null);}).catch(e=>notify(e.message))}>로그아웃</button></div></>:<form onSubmit={e=>{e.preventDefault();const run=authMode==='signup'?store.signup(authEmail,authPassword):store.login(authEmail,authPassword).then(()=>false);run.then(needsConfirm=>{setAuthPassword('');if(needsConfirm){setAuthSent(true);notify('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 다시 로그인해 주세요.');}else{setAuthSent(false);notify(authMode==='signup'?'계정을 만들고 로그인했어요.':'로그인했어요.');}}).catch(e=>notify(e.message));}}><Field label="이메일"><input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} required autoComplete="username" placeholder="name@example.com"/></Field><Field label="비밀번호"><input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required minLength={8} autoComplete={authMode==='signup'?'new-password':'current-password'} placeholder="8자 이상"/></Field><button className="primary" disabled={!store.config}>{authMode==='signup'?'계정 만들고 시작하기':'로그인'}<ArrowRight size={16}/></button><button type="button" className="text-button" onClick={()=>{setAuthMode(m=>m==='signup'?'login':'signup');setAuthSent(false);}}>{authMode==='signup'?'이미 계정이 있어요 · 로그인하기':'계정이 없어요 · 새로 만들기'}</button><p className="small-note">{authMode==='signup'?'휴대폰에서도 같은 이메일과 비밀번호로 로그인하면 두 기기가 같은 공간을 씁니다.':'처음이라면 아래에서 계정을 먼저 만들어 주세요.'}</p>{authSent&&<p className="small-note">메일의 확인 링크를 누른 뒤, 이 화면에서 같은 이메일과 비밀번호로 로그인해 주세요.</p>}</form>}<details className="advanced"><summary>동기화 서비스 연결 설정</summary><p className="small-note">본인이 관리하는 Supabase 프로젝트를 연결할 때만 입력하세요. 데이터는 해당 프로젝트로 전송됩니다. DB 설치 파일은 저장소의 app/supabase/schema.sql에 있습니다.</p><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{store.configure({url:text(f,'url'),key:text(f,'key')});notify('서비스를 연결했어요. 이메일로 로그인해 주세요.');}catch(e){notify((e as Error).message);}}}><Field label="프로젝트 URL"><input name="url" type="url" required defaultValue={store.config?.url??''} placeholder="https://project.supabase.co"/></Field><Field label="공개 publishable key"><input name="key" required defaultValue={store.config?.key??''} placeholder="sb_publishable_…" autoComplete="off"/></Field><button className="secondary">연결 저장</button></form></details><p className="small-note">로그인하면 계정별 공간을 불러옵니다. 기기 공간의 기존 기록을 옮기려면 로그인 전에 백업한 뒤 로그인 후 가져와 주세요.</p></section>
 <section className="panel settings-panel"><h2><ArrowDownToLine size={20}/>기록 보관</h2><p>백업 파일에는 현재 공간의 모든 기록이 담겨요. 기기를 바꾸기 전에도 한 번 저장해 두세요.</p><div className="button-row"><button className="primary" onClick={exportBackup}>백업 내려받기</button><button className="secondary" onClick={()=>importRef.current?.click()}>백업 가져오기</button></div><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={e=>void importFile(e.target.files?.[0])}/><hr/><h3>나의 공간</h3><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);change(s=>({...s,name:text(f,'name'),chapter:text(f,'chapter')}),'공간 이름을 바꿨어요.');}}><Field label="공간 이름"><input name="name" required maxLength={100} defaultValue={s.name} key={s.name}/></Field><Field label="현재 챕터"><input name="chapter" required maxLength={150} defaultValue={s.chapter} key={s.chapter}/></Field><button className="secondary">저장</button></form><hr/><button className="text-button" onClick={()=>demo?store.startPersonal():store.viewDemo()}>{demo?'내 개인 공간으로 이동':'가상 예시 다시 둘러보기'}<ArrowRight size={15}/></button><p className="small-note">예시 공간과 개인 기록은 분리돼 있어요. 예시의 변경은 저장되지 않습니다.</p></section></div><section className="panel settings-panel"><h2>최근 변경 이력</h2>{s.events.slice(0,12).map(e=><div className="event-row" key={e.id}><span>{e.text}</span><small>{new Date(e.at).toLocaleString('ko-KR')}</small></div>)}{!s.events.length&&<p className="muted">새로운 활동이 이곳에 기록됩니다.</p>}<p className="small-note">LIFE v0.1 · 실제 관측과 시뮬레이션을 구분합니다. 미래의 성공률은 근거가 쌓이기 전까지 미산정입니다.</p></section></>}
 <footer className="page-footer"><Sprout size={14}/><span>나의 삶은, 계속 자라는 중.</span><span>LIFE · ONE STEP AT A TIME</span></footer>
 </main></div>
 <nav className="mobile-nav">{nav.map(n=><button key={n.id} className={view===n.id?'active':''} onClick={()=>go(n.id)} aria-label={n.label}><n.icon size={19}/><span>{n.short}</span></button>)}</nav>
 {levelUp&&<div className="levelup-scrim" onClick={()=>setLevelUp(null)}><div className="levelup-card" role="alert">
 <span className="levelup-tag"><Trophy size={15}/>레벨 업</span>
 {levelUp.ups.map(u=><p key={u.domain.id} className="levelup-stat"><b>{u.name}</b> Lv.{u.level} <span>{u.from} → <strong>{u.to}</strong></span></p>)}
 <div className="levelup-power"><span>전투력</span><b>{levelUp.from}</b><ArrowRight size={18}/><b className="levelup-after">{levelUp.to}</b></div>
 <button className="primary full" onClick={()=>setLevelUp(null)}>계속하기</button></div></div>}
 {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
 {suggestion&&<div className="suggestion" role="status">
   <span className="suggestion-icon"><Compass size={17}/></span>
   <p>{suggestion.text}</p>
   <div className="suggestion-actions">
    {suggestion.switchTo&&suggestion.planId&&<button className="primary" onClick={()=>{
      const to=suggestion.switchTo!,pid=suggestion.planId!;
      change(s=>log({...s,plans:s.plans.map(p=>p.id===pid?{...p,active:to}:p)},`경로 전환 · ${to}`),`${to} 경로로 바꿨어요.`);
      setSuggestion(null);}}>{suggestion.switchTo} 경로로 바꾸기</button>}
    <button className="secondary" onClick={()=>setSuggestion(null)}>닫기</button>
   </div>
  </div>}
 {store.conflict&&<Modal title="다른 기기에서도 기록이 바뀌었어요" onClose={()=>notify('기록을 선택할 때까지 동기화가 잠시 멈춥니다.')}><p>한 공간의 전체 기록이 서로 다릅니다. 먼저 현재 기기 기록을 백업한 뒤, 유지할 버전을 선택해 주세요. 선택하지 않은 변경은 덮어써집니다.</p>{(()=>{const c=compareWorkspaces(s,store.conflict!.data);return <>
 <table className="conflict-table"><thead><tr><th>항목</th><th>이 기기</th><th>서버</th></tr></thead><tbody>
 {c.rows.map(r=><tr key={r.key} className={r.diff?'differs':''}><th scope="row">{r.label}</th>
  <td className={r.diff>0?'more':r.diff<0?'less':''}>{r.mine}</td>
  <td className={r.diff<0?'more':r.diff>0?'less':''}>{r.theirs}</td></tr>)}
 </tbody></table>
 {c.mineLoses.length>0&&<p className="conflict-warn" role="alert">‘서버 기록 사용’ 을 고르면 <b>{c.mineLoses.map(r=>`${r.label} ${r.diff}개`).join(' · ')}</b> 가 사라져요.</p>}
 {c.theirsLoses.length>0&&<p className="conflict-warn" role="alert">‘이 기기 기록 사용’ 을 고르면 <b>{c.theirsLoses.map(r=>`${r.label} ${-r.diff}개`).join(' · ')}</b> 가 사라져요.</p>}
 {!c.mineLoses.length&&!c.theirsLoses.length&&<p className="small-note">개수는 같습니다. 내용이 다를 수 있으니 백업을 먼저 받아 주세요.</p>}
</>;})()}<button className="secondary" onClick={exportBackup}>이 기기 기록 백업</button><div className="modal-actions"><button className="secondary" onClick={()=>void store.resolveConflict('remote')}>서버 기록 사용</button><button className="primary" onClick={()=>{if(confirm('서버 기록 전체를 이 기기의 기록으로 바꿀까요?'))void store.resolveConflict('local');}}>이 기기 기록 사용</button></div></Modal>}
 {dialog?.type==='outcome'&&<Modal title="오늘은 어디까지 갔나요?" onClose={()=>setDialog(null)}>
  <p className="outcome-intro"><strong>{dialog.item.title}</strong><span>{dialog.item.criterion||'완료 기준이 적혀 있지 않아요.'}</span></p>
  <div className="outcome-grid">
   {(['full','partial','missed'] as Outcome[]).map(k=>{
    const gained=Math.round(dialog.item.xp*OUTCOME[k].ratio);
    return <button key={k} type="button" className={`outcome-card ${k}`} onClick={()=>finishQuest(dialog.item,k)}>
      <span className="outcome-mark">{k==='full'?<CheckCheck size={20}/>:k==='partial'?<Circle size={19}/>:<MoreHorizontal size={20}/>}</span>
      <strong>{OUTCOME[k].label}</strong>
      <small>+{gained} XP</small>
      {(k==='full'?dialog.item.criterion:k==='partial'?dialog.item.partialCriterion:dialog.item.minimumCriterion)&&
        <em className="outcome-criterion">{k==='full'?dialog.item.criterion:k==='partial'?dialog.item.partialCriterion:dialog.item.minimumCriterion}</em>}
    </button>;})}
  </div>
  <p className="small-note">못 했어도 0 이 아니에요. 시도하고 기록한 것이 다음 판단의 근거가 됩니다.</p>
 </Modal>}
 {dialog&&dialog.type!=='outcome'&&<Modal title={{quest:dialog.type==='quest'&&dialog.item?'퀘스트 다듬기':'새로운 작은 한 걸음',plan:'나의 플랜 ABC',observation:'지금의 나 기록하기',reward:'기다려지는 작은 보상',domain:'새로운 성장 분야',review:'이번 주의 나에게',import:'백업 가져오기',outcome:'오늘은 어디까지 갔나요?'}[dialog.type]} onClose={()=>setDialog(null)}>{dialog.type==='import'?<><p>가져올 공간: <b>{dialog.data.name}</b></p>
<p>퀘스트 {dialog.data.quests.length}개 · 플랜 {dialog.data.plans.length}개 · 기록 {dialog.data.observations.length}개 · 보상 {dialog.data.rewards.length}개</p>
<p>시뮬레이션 {dialog.data.sim?<b>{`손잡이 ${dialog.data.sim.levers.length}개`}</b>:<em className="warn-inline">없음 — 이 파일에는 예측 자료가 안 들어 있어요</em>}</p>
{demo
 ?<div className="notice warn"><b>지금은 예시 공간이에요.</b> 여기에 가져오면 <b>저장되지 않아요</b> — 새로고침하면 사라져요.<br/>먼저 내 공간으로 바꾼 뒤 다시 가져와 주세요.</div>
 :<div className="notice">현재 공간 전체를 이 백업으로 바꿉니다. 로그인 상태에서는 연결된 클라우드에도 반영됩니다.</div>}
<div className="modal-actions"><button className="secondary" onClick={exportBackup}>현재 기록 백업</button>
{demo
 ?<button className="primary" onClick={()=>{store.startPersonal();setDialog(null);notify('내 공간으로 바꿨어요. 백업 가져오기를 한 번 더 눌러 주세요.');}}>내 공간으로 바꾸기</button>
 :<button className="primary" onClick={()=>{change(()=>dialog.data,'백업 기록을 가져왔어요.');setDialog(null);}}>이 기록으로 교체</button>}</div></>:<form onSubmit={submit}>
 {dialog.type==='quest'&&<><Field label="어떤 한 걸음을 내딛을까요?"><input name="title" required maxLength={200} placeholder="예: 이번 달 정기결제 목록 확인하기" defaultValue={dialog.item?.title}/></Field><div className="form-grid"><Field label="분야">{domainSelect(dialog.item?.domainId)}</Field><Field label="예정일"><input type="date" name="due" required defaultValue={dialog.item?.due??today()}/></Field><Field label="예상 시간 (분)"><input name="minutes" type="number" min="0" max="10000" required defaultValue={dialog.item?.minutes??10}/></Field><Field label="경험치"><select name="xp" defaultValue={dialog.item?.xp??15}><option value="5">관측 · 5 XP</option><option value="15">실행 · 15 XP</option><option value="30">결과물 · 30 XP</option><option value="10">회고 · 10 XP</option></select></Field></div><Field label="완료했다고 말할 수 있는 기준"><textarea name="criterion" required maxLength={2000} placeholder="목록과 다음 결제일을 기록했어요." defaultValue={dialog.item?.criterion}/></Field><Field label="절반쯤 했다고 할 수 있는 기준 (선택)"><input name="partialCriterion" maxLength={2000} placeholder="목록은 봤지만 정리는 못 했어요." defaultValue={dialog.item?.partialCriterion??''}/></Field><Field label="반복"><select name="repeat" defaultValue={dialog.item?.repeat??'none'}><option value="none">한 번만</option><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매달</option></select></Field><Field label="최소한 이것만은 (선택)"><input name="minimumCriterion" maxLength={2000} placeholder="앱을 열어 한 줄이라도 적었어요." defaultValue={dialog.item?.minimumCriterion??''}/></Field><Field label="연결할 플랜"><select name="plan" defaultValue={dialog.item?.planId??''}><option value="">연결하지 않음</option>{s.plans.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>{dialog.item&&<div className="button-row"><button type="button" className="secondary" onClick={()=>{change(s=>({...s,quests:s.quests.map(q=>q.id===dialog.item!.id?{...q,status:q.status==='paused'?'ready':'paused',completedAt:null}:q)}),'퀘스트 상태를 바꿨어요.');setDialog(null);}}>{dialog.item.status==='paused'?'다시 시작':'잠시 보류'}</button><button type="button" className="text-button danger" onClick={()=>{if(confirm('퀘스트를 삭제할까요? 완료 경험치도 제거됩니다.')){change(s=>log({...s,quests:s.quests.filter(q=>q.id!==dialog.item!.id)},'퀘스트 삭제'));setDialog(null);}}}>삭제</button></div>}</>}
 {dialog.type==='plan'&&<><Field label="플랜 이름"><input name="title" required maxLength={200} defaultValue={dialog.item?.title} placeholder="생활의 여유 만들기"/></Field><Field label="성공했다고 판단할 구체적인 목표"><input name="goal" required maxLength={200} defaultValue={dialog.item?.goal} placeholder="이번 달 정기 지출 3개 확인하기"/></Field><Field label="분야">{domainSelect(dialog.item?.domainId)}</Field>{(['A','B','C'] as const).map((k,i)=>{const b=dialog.item?.branches.find(x=>x.key===k);return <fieldset key={k}><legend>PLAN {k} · {['기본 경로','대체 경로','최소 목표'][i]}</legend><Field label="경로 이름"><input name={`title${k}`} required maxLength={200} defaultValue={b?.title??['차근차근 실행하기','핵심 한 가지에 집중','최소 행동 이어가기'][i]}/></Field><div className="form-grid"><Field label="필요 자금 (원)"><input name={`cost${k}`} type="number" min="0" max="1000000000000" required defaultValue={b?.cost??0}/></Field><Field label="주간 필요 시간"><input name={`hours${k}`} type="number" min="0" max="168" step="0.25" required defaultValue={b?.hours??[2,1,0.25][i]}/></Field><Field label="기간 (일)"><input name={`duration${k}`} type="number" min="1" max="3650" required defaultValue={b?.duration??30}/></Field><Field label="경로 전환 비용 (원)"><input name={`switch${k}`} type="number" min="0" max="1000000000000" required defaultValue={b?.switchCost??0}/></Field></div><Field label="이 경로의 완료 기준"><input name={`result${k}`} required maxLength={200} defaultValue={b?.result}/></Field><Field label="막히면 언제 다음 길을 검토할까요?"><input name={`trigger${k}`} maxLength={2000} defaultValue={b?.trigger} placeholder="예: 2주 동안 진행이 없으면 B 검토"/></Field>
     <details className="rule-editor" open={!!b?.rule}><summary>이 조건을 앱이 직접 확인하게 하기 (선택)</summary>
      <p className="small-note">규칙을 넣으면 조건이 맞을 때 플랜이 스스로 알려 줍니다. 비워 두면 위 문장만 남습니다.</p>
      <div className="rule-row">
       <select name={`ruleWhen${k}`} defaultValue={b?.rule?.when??''} aria-label={`${k} 조건 종류`}>
        <option value="">앱이 확인하지 않음</option>
        <option value="outcomes">최근 결과가 약하면</option>
        <option value="streak">연달아 끝까지 하면</option>
        <option value="idle">한동안 완료가 없으면</option>
        <option value="observation">기록한 값이 기준을 넘으면</option>
       </select>
       <select name={`ruleTo${k}`} defaultValue={b?.rule?.to??'C'} aria-label={`${k} 전환 대상`}>
        {(['A','B','C'] as const).map(x=><option key={x} value={x}>{x} 경로로</option>)}
       </select>
      </div>
      <div className="rule-row">
       <input name={`ruleN${k}`} type="number" min="0" step="any" aria-label={`${k} 기준값`}
         defaultValue={b?.rule?(b.rule.when==='outcomes'?b.rule.recent:b.rule.when==='streak'?b.rule.full:b.rule.when==='idle'?b.rule.days:b.rule.value):3} placeholder="횟수 / 일수 / 금액"/>
       <input name={`ruleM${k}`} type="number" min="0" aria-label={`${k} 약한 횟수`}
         defaultValue={b?.rule?.when==='outcomes'?b.rule.weak:2} placeholder="그중 약한 횟수"/>
      </div>
      <div className="rule-row">
       <select name={`ruleKind${k}`} defaultValue={b?.rule?.when==='observation'?b.rule.kind:'hours'} aria-label={`${k} 기록 종류`}>
        {(Object.keys(OBS_NAME) as (keyof typeof OBS_NAME)[]).map(x=><option key={x} value={x}>{OBS_NAME[x]}</option>)}
       </select>
       <select name={`ruleOp${k}`} defaultValue={b?.rule?.when==='observation'?b.rule.op:'lt'} aria-label={`${k} 비교`}>
        <option value="lt">보다 아래면</option><option value="gt">보다 위면</option>
       </select>
      </div>
      {b?.rule&&<p className="rule-current">지금 규칙 · {ruleText(b.rule)}</p>}
     </details></fieldset>;})}</>}
 {dialog.type==='observation'&&<><Field label="기록할 항목"><select name="kind">{OBS_GROUPS.map(([g,ks])=><optgroup key={g} label={g}>{ks.map(k=><option key={k} value={k}>{OBS_NAME[k]} ({OBS_UNIT[k]})</option>)}</optgroup>)}</select></Field><div className="form-grid"><Field label="값"><input name="value" type="number" min="0" max="1000000000000" step="any" required placeholder="직접 확인한 값"/></Field><Field label="기준일"><input name="date" type="date" max={today()} required defaultValue={today()}/></Field></div><Field label="포함 범위 또는 메모"><textarea name="note" maxLength={2000} placeholder="예: 생활비 계좌와 비상금 계좌의 합계"/></Field><p className="small-note">모르는 값은 입력하지 않아도 돼요. 포커 송금·회수는 게임 손익이 아니라 통장에서 오간 돈입니다.</p></>}
 {dialog.type==='reward'&&<><Field label="어떤 보상이 기다려지나요?"><input name="title" required maxLength={200} placeholder="예: 나를 위한 영화 한 편"/></Field><div className="form-grid"><Field label="종류"><select name="type"><option value="real">활동 · 물건</option><option value="digital">칭호 · 성장 배지</option></select></Field><Field label="잠금 해제 경험치"><input name="requiredXp" type="number" min="0" max="10000000" required defaultValue={100}/></Field><Field label="어느 성장으로 열까요"><select name="rewardDomain" defaultValue=""><option value="">전체 성장</option>{s.domains.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="왜 기다려지나요 (선택)"><input name="note" maxLength={1000} placeholder="보고 싶었던 영화를 혼자 느긋하게"/></Field></div><Field label="예상 비용 (원, 무료 보상은 0)"><input name="cost" type="number" min="0" max="1000000000000" required defaultValue={0}/></Field><p className="small-note">경험치는 사용해도 사라지지 않아요. 유료 보상은 예산 안에서 예약해요.</p></>}
 {dialog.type==='domain'&&<><Field label="분야 이름"><input name="name" required maxLength={100} placeholder="예: 나만의 프로젝트"/></Field><div className="form-grid"><Field label="색상"><select name="color">{[['sage','세이지'],['blue','블루'],['amber','앰버'],['rose','로즈'],['violet','바이올렛'],['teal','틸']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field><Field label="아이콘"><select name="icon">{[['wallet','지갑'],['sprout','새싹'],['briefcase','일'],['book','책'],['heart','마음'],['sparkles','영감']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field></div></>}
 {dialog.type==='review'&&<>{(()=>{const w=weekStats(s);return <div className="week-summary-box"><strong>지난 7일</strong>{w.done?<><div className="week-bars"><span className="wb full" style={{flex:w.full||0}}/><span className="wb partial" style={{flex:w.partial||0}}/><span className="wb missed" style={{flex:w.missed||0}}/></div><p>완료 {w.done}개 · 끝까지 {w.full} · 절반 {w.partial} · 못 함 {w.missed} · <b>+{w.xp} XP</b>{w.done?` · 완주 ${Math.round(w.full/w.done*100)}%`:''}</p></>:<p className="muted">완료한 퀘스트가 없어요. 그런 주도 있습니다.</p>}<small>이 수치는 회고와 함께 저장돼요.</small></div>;})()}<Field label="작지만 잘해낸 일"><textarea name="win" required maxLength={4000} placeholder="이번 주에 남긴 작은 발자국은…"/></Field><Field label="어려웠던 점"><textarea name="obstacle" maxLength={4000} placeholder="어떤 상황이 계획을 어렵게 했나요?"/></Field><Field label="다음 주의 한 걸음"><textarea name="next" required maxLength={4000} placeholder="더 쉽게 시작하기 위해 바꿔볼 것은…"/></Field></>}
 <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setDialog(null)}>취소</button><button className="primary" type="submit">저장하기<Check size={16}/></button></div></form>}</Modal>}
 {simOpen&&(()=>{const p=s.plans.find(x=>x.id===simPlan);if(!p)return null;const simulated={...s,observations:[...(simCash!==''?[{id:'sim-cash',kind:'cash' as const,value:Number(simCash),date:'9999-12-31',note:'가정'}]:[]),...(simHours!==''?[{id:'sim-hours',kind:'hours' as const,value:Number(simHours),date:'9999-12-31',note:'가정'}]:[]),...s.observations]};return <Modal title="상황이 달라진다면?" onClose={()=>setSimOpen(false)}><Badge color="amber">가상 비교 · 실제 기록은 바뀌지 않아요</Badge><p>{p.title}의 자원 조건을 비교해요.</p><div className="form-grid"><Field label="가용 현금 가정 (원)"><input type="number" min="0" value={simCash} onChange={e=>setSimCash(e.target.value)}/></Field><Field label="주간 가용시간 가정"><input type="number" min="0" max="168" value={simHours} onChange={e=>setSimHours(e.target.value)}/></Field></div>{p.branches.map(b=>{const a=assessBranch(simulated,p,b.key);return <div className="simulation-result" key={b.key}><b>PLAN {b.key}</b><span>{b.title}</span><Badge color={a.state==='ready'?'sage':'amber'}>{a.state==='ready'?'조건 충족':a.reasons.join(' · ')}</Badge></div>;})}<p className="small-note">경로별 자금·시간 요구만 비교합니다. 생활 필수비와 미래 수입이 모두 반영된 현금 예측이나 성공 확률은 아닙니다. 전환 비용은 다른 경로를 선택할 때 포함됩니다.</p></Modal>;})()}
 </div>;
}

function WeekDots({quests}:{quests:Quest[]}){const now=new Date();const day=(now.getDay()+6)%7;return <div className="week-dots">{['월','화','수','목','금','토','일'].map((label,i)=>{const d=new Date(now);d.setDate(now.getDate()-day+i);const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,count=quests.filter(q=>q.status==='done'&&q.completedAt?.slice(0,10)===date).length;return <div key={label} className={i===day?'current':''}><small>{label}</small><span className={count?'filled':''}>{count?<Check size={15}/>:d.getDate()}</span><i/></div>;})}</div>;}
// 현금 흐름 — 날짜 간격을 실제로 반영한 영역 그래프.
// viewBox 를 실제 픽셀 폭에 맞춘다. preserveAspectRatio="none" 으로 늘이면 글자가 가로로 찌그러진다.
function CashChart({observations}:{observations:Workspace['observations']}){
 const box=useRef<HTMLDivElement>(null);
 const [W,setW]=useState(760);
 useEffect(()=>{const el=box.current;if(!el)return;
  const ro=new ResizeObserver(([e])=>setW(Math.max(320,Math.round(e.contentRect.width))));
  ro.observe(el);return()=>ro.disconnect();},[]);
 const seen=new Set<string>();
 const rows=observations.filter(o=>{if(o.kind!=='cash'||seen.has(o.date))return false;seen.add(o.date);return true;})
   .sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
 if(!rows.length)return <Empty title="첫 현금 기록을 남겨보세요" body="기록이 쌓이면 변화가 한눈에 보여요."/>;
 const H=200,PAD={l:16,r:16,t:30,b:32};
 const day=(d:string)=>Date.parse(d+'T00:00:00Z')/86400000;
 const xs=rows.map(r=>day(r.date)),ys=rows.map(r=>r.value);
 const x0=Math.min(...xs),x1=Math.max(...xs),span=Math.max(1,x1-x0);
 const yMax=Math.max(...ys),yMin=Math.min(...ys),range=Math.max(1,yMax-yMin||yMax*0.25);
 const px=(d:number)=>rows.length===1?W/2:PAD.l+(d-x0)/span*(W-PAD.l-PAD.r);
 const py=(v:number)=>PAD.t+(1-(v-(yMin-range*0.15))/(range*1.3))*(H-PAD.t-PAD.b);
 const pts=rows.map((r,i)=>({x:px(xs[i]),y:py(r.value),r}));
 const line=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
 const area=`${line} L${pts[pts.length-1].x.toFixed(1)},${H-PAD.b} L${pts[0].x.toFixed(1)},${H-PAD.b} Z`;
 // 날짜 간격을 그대로 쓰면 가까운 점의 글자가 겹친다. 뒤에서부터 간격을 확보하며 솎아낸다 —
 // 마지막(가장 최근) 값은 언제나 보인다.
 const pick=(gap:number)=>{const on=new Array(pts.length).fill(false);let last=Infinity;
  for(let i=pts.length-1;i>=0;i--)if(last-pts[i].x>=gap){on[i]=true;last=pts[i].x;}
  return on;};
 const showValue=pick(96),showDate=pick(64);
 return <div className="cash-chart" ref={box}>
  <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
    aria-label={`현금 기록 ${rows.length}건, 최근 ${won(pts[pts.length-1].r.value)}`}>
   <defs><linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0%" stopColor="var(--neon)" stopOpacity="0.28"/>
     <stop offset="100%" stopColor="var(--neon)" stopOpacity="0"/>
    </linearGradient></defs>
   {[0,.5,1].map(f=><line key={f} className="cash-grid" x1={PAD.l} x2={W-PAD.r}
     y1={PAD.t+f*(H-PAD.t-PAD.b)} y2={PAD.t+f*(H-PAD.t-PAD.b)}/>)}
   {rows.length>1&&<path className="cash-area" d={area} fill="url(#cashFill)"/>}
   {rows.length>1&&<path className="cash-line" d={line}/>}
   {pts.map((p,i)=>{const last=i===pts.length-1;
    return <g key={p.r.id} className="cash-point" style={{animationDelay:`${260+i*110}ms`}}>
     <circle cx={p.x} cy={p.y} r={last?5.5:3.8}><title>{`${p.r.date} · ${won(p.r.value)}${p.r.note?` · ${p.r.note}`:''}`}</title></circle>
     {showValue[i]&&<text x={Math.min(Math.max(p.x,58),W-58)} y={p.y-14}>{won(p.r.value)}</text>}
     {showDate[i]&&<text className="cash-date" x={Math.min(Math.max(p.x,24),W-24)} y={H-10}>{p.r.date.slice(5)}</text>}
    </g>;})}
  </svg>
 </div>;
}

