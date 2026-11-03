import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, BriefcaseBusiness, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleHelp, Cloud, CloudOff, Compass, Flag, Gift, Heart, Home, Leaf, ListChecks, LockKeyhole, Map, Menu, MoreHorizontal, Plus, RefreshCw, Settings, Sparkles, Sprout, Target, Trash2, TrendingUp, Trophy, Swords, Zap, Wallet, X } from 'lucide-react';
import { OBS_GROUPS, OBS_UNIT, checkObservation, obsText, statList, combatPower, powerDiff, questQueue, focusQuest, subQuestFor, acceptSubQuest, OUTCOME, OBS_NAME, weekStats, nextSuggestion, accuracy, pokerNet, rewardProgress, evaluateTriggers, ruleText, type TriggerRule, type Outcome, assessBranch, completeQuest, createEmpty, latest, level, log, parseBackup, reserveReward, rewardAvailable, today, uid, won, xpOf, type Plan, type Quest, type Workspace } from './model';
import { AuthGate, NewPassword } from './Auth';
import { useWorkspace } from './store';

type View='today'|'map'|'plans'|'quests'|'records'|'review'|'rewards'|'settings';
type Dialog={type:'outcome';item:Quest}|{type:'quest';item?:Quest}|{type:'plan';item?:Plan}|{type:'observation'}|{type:'reward'}|{type:'domain'}|{type:'review'}|{type:'import';data:Workspace}|null;
const nav=[{id:'today',label:'오늘',icon:Home},{id:'map',label:'성장 지도',icon:Map},{id:'plans',label:'목표와 플랜',icon:Flag},{id:'quests',label:'퀘스트',icon:ListChecks},{id:'records',label:'나의 기록',icon:BookOpen},{id:'review',label:'주간 회고',icon:RefreshCw},{id:'rewards',label:'보상함',icon:Gift}] as const;
const icons={wallet:Wallet,sprout:Sprout,briefcase:BriefcaseBusiness,book:BookOpen,heart:Heart,sparkles:Sparkles};
const kindNames=OBS_NAME;   // 이름표 정본은 model.ts 하나다
const text=(f:FormData,k:string)=>String(f.get(k)??'').trim();
const num=(f:FormData,k:string)=>{const n=Number(f.get(k));if(!Number.isFinite(n)||n<0)throw Error('올바른 숫자를 입력해 주세요.');return n;};

function Badge({children,color='sage'}:{children:ReactNode;color?:string}){return <span className={`badge ${color}`}>{children}</span>;}
function DomainIcon({domain,size=20}:{domain:Workspace['domains'][number];size?:number}){const Icon=icons[domain.icon];return <span className={`domain-icon ${domain.color}`}><Icon size={size}/></span>;}
function Empty({title,body,action}:{title:string;body:string;action?:ReactNode}){return <div className="empty"><Sprout size={32}/><h3>{title}</h3><p>{body}</p>{action}</div>;}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20}/></button></div>{children}</dialog>;}

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
 const [view,setView]=useState<View>('today'),[menu,setMenu]=useState(false),[dialog,setDialog]=useState<Dialog>(null),[toast,setToast]=useState(''),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[selectedDomain,setSelectedDomain]=useState('finance'),[gate,setGate]=useState(()=>localStorage.getItem('life:gate')),[planFilter,setPlanFilter]=useState('all'),[planQuery,setPlanQuery]=useState(''),[openPlans,setOpenPlans]=useState<string[]>([]),[suggestion,setSuggestion]=useState<{text:string;switchTo?:'A'|'B'|'C';planId?:string}|null>(null),[authEmail,setAuthEmail]=useState(''),[authPassword,setAuthPassword]=useState(''),[authMode,setAuthMode]=useState<'login'|'signup'>('login'),[authSent,setAuthSent]=useState(false),[simPlan,setSimPlan]=useState(''),[simCash,setSimCash]=useState(''),[simHours,setSimHours]=useState(''),[simOpen,setSimOpen]=useState(false),[levelUp,setLevelUp]=useState<ReturnType<typeof powerDiff>|null>(null);
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
 if(dialog.type==='quest'){const q:Quest={id:dialog.item?.id??uid(),title:text(f,'title'),domainId:text(f,'domain'),minutes:num(f,'minutes'),xp:num(f,'xp'),due:text(f,'due'),criterion:text(f,'criterion'),partialCriterion:text(f,'partialCriterion'),minimumCriterion:text(f,'minimumCriterion'),planId:text(f,'plan'),repeat:(text(f,'repeat')||'none') as 'none'|'daily'|'weekly',status:dialog.item?.status??'ready',completedAt:dialog.item?.completedAt??null,outcome:dialog.item?.outcome??null};store.update(s=>log({...s,quests:dialog.item?s.quests.map(x=>x.id===q.id?q:x):[q,...s.quests]},`${q.title} · ${dialog.item?'수정':'추가'}`));}
 if(dialog.type==='plan'){const p:Plan={id:dialog.item?.id??uid(),title:text(f,'title'),goal:text(f,'goal'),domainId:text(f,'domain'),active:dialog.item?.active??'A',branches:(['A','B','C'] as const).map(key=>({key,title:text(f,`title${key}`),cost:num(f,`cost${key}`),hours:num(f,`hours${key}`),duration:num(f,`duration${key}`),result:text(f,`result${key}`),trigger:text(f,`trigger${key}`),rule:buildRule(f,key),switchCost:num(f,`switch${key}`)}))};store.update(s=>log({...s,plans:dialog.item?s.plans.map(x=>x.id===p.id?p:x):[p,...s.plans]},`${p.title} · 플랜 저장`));}
 if(dialog.type==='observation'){const o={id:uid(),kind:text(f,'kind') as keyof typeof kindNames,value:num(f,'value'),date:text(f,'date'),note:text(f,'note')};const bad=checkObservation(o.kind,o.value);if(bad)throw Error(bad);store.update(s=>log({...s,observations:[o,...s.observations]},`${kindNames[o.kind]} 기록 추가`));}
 if(dialog.type==='reward')store.update(s=>({...s,rewards:[{id:uid(),title:text(f,'title'),type:text(f,'type') as 'real'|'digital',cost:num(f,'cost'),requiredXp:num(f,'requiredXp'),domainId:text(f,'rewardDomain'),note:text(f,'note'),status:'wish',spent:null,usedAt:null,reservedAt:null},...s.rewards]}));
 if(dialog.type==='domain')store.update(s=>({...s,domains:[...s.domains,{id:uid(),name:text(f,'name'),color:text(f,'color') as 'sage',icon:text(f,'icon') as 'wallet'}]}));
 if(dialog.type==='review')store.update(s=>log({...s,reviews:[{id:uid(),date:today(),win:text(f,'win'),obstacle:text(f,'obstacle'),next:text(f,'next'),stats:weekStats(s)},...s.reviews]},'주간 회고를 남겼어요'));
 setDialog(null);notify('저장했어요. 다음 한 걸음도 나의 속도로.');}catch(e){notify((e as Error).message);}}
 const domainSelect=(value?:string)=><select name="domain" defaultValue={value??s.domains[0].id}>{s.domains.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>;
 function questRow(q:Quest){const d=s.domains.find(x=>x.id===q.domainId)!;return <div key={q.id} className={`quest-row ${q.status==='done'?'is-done':''}`}><button className="check-button" aria-label={`${q.title} ${q.status==='done'?'완료 취소':'완료'}`} onClick={()=>toggle(q)} disabled={!ready}>{q.status==='done'?<Check size={16}/>:null}</button><button className="quest-content" onClick={()=>setDialog({type:'quest',item:q})}><strong>{q.title}</strong><span><i className={`dot ${d.color}`}/>{d.name}<b>·</b>{q.minutes}분{q.due<today()&&q.status==='ready'&&<em>일정 다시 보기</em>}</span></button>{q.repeat!=='none'&&<span className="repeat-chip"><RefreshCw size={11}/>{q.repeat==='daily'?'매일':'매주'}</span>}{q.status==='done'&&q.outcome&&q.outcome!=='full'&&<span className={`outcome-chip ${q.outcome}`}>{q.outcome==='partial'?'절반':'못 함'}</span>}<span className="xp-pill">{q.status==='done'&&q.outcome?`+${Math.round(q.xp*OUTCOME[q.outcome].ratio)}`:`+${q.xp}`} <small>XP</small></span><button className="icon-button" aria-label={`${q.title} 편집`} onClick={()=>setDialog({type:'quest',item:q})}><MoreHorizontal size={18}/></button></div>;}
 const sectionHead=(eyebrow:string,title:string,desc:string,action?:ReactNode)=><div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>;
 function domainCards(compact=false){return <div className={`domain-grid ${compact?'compact':''}`}>{s.domains.map(d=>{const dxp=xpOf(s,d.id),lv=level(dxp);return <button key={d.id} className={`domain-card ${d.color}`} onClick={()=>{setSelectedDomain(d.id);go('map');}}><div className="domain-card-top"><DomainIcon domain={d}/><span>Lv. {lv.level}</span></div><h3>{d.name}</h3><p>{s.quests.filter(q=>q.domainId===d.id&&q.status==='done').length}개의 작은 성취{(()=>{const a=accuracy(s,d.id);return a?<em className="accuracy"> · 완주 {Math.round(a.ratio*100)}%</em>:null;})()}</p><div className="progress-track"><i style={{width:`${Math.max(2,lv.progress*100)}%`}}/></div><div className="progress-label"><span>{dxp} XP</span><span>{lv.next} XP</span></div></button>;})}</div>;}
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
 <aside className={`sidebar ${menu?'open':''}`}><button className="brand" onClick={()=>go('today')}><span className="brand-mark"><Sprout size={24}/></span><span>LIFE<span className="brand-sub">YOUR LIFE, IN PROGRESS</span></span></button>
 <div className="workspace-switch"><span className="avatar">L</span><div><strong>{s.name}</strong><small>나만의 라이프 워크스페이스</small></div><ChevronDown size={15}/></div>
 <div className="nav-caption">MY WORKSPACE</div><nav>{nav.map(n=><button key={n.id} className={view===n.id?'active':''} onClick={()=>go(n.id)}><n.icon size={19}/><span>{n.label}</span>{n.id==='quests'&&open.length>0&&<small>{open.length}</small>}{n.id==='rewards'&&<i className="nav-spark"/>}</button>)}</nav>
 <div className="sidebar-note"><div><Leaf size={17}/><span>작은 걸음도, 앞으로.</span></div><p>오늘의 나에게 맞는<br/>속도로 걸어가면 돼요.</p><svg viewBox="0 0 160 38" aria-hidden="true"><path d="M0 35Q30 0 60 25T120 17T160 8" fill="none" stroke="#b6c8a6" strokeWidth="2" strokeDasharray="4 5"/><circle cx="120" cy="17" r="4" fill="#799063"/></svg></div>
 <div className="sidebar-bottom"><button className={view==='settings'?'active':''} onClick={()=>go('settings')}><Settings size={18}/>설정과 동기화</button><div className={`profile ${store.user?'signed-in':'signed-out'}`}><div className="profile-avatar">{store.user?<Check size={15}/>:'나'}</div><div className="profile-id"><strong>{store.user?store.user.email:demo?'예시 공간':'로그인 안 됨'}</strong><small>{demo?'둘러보는 중 · 저장되지 않아요':store.user?'모든 기기에서 이어져요':'이 기기에만 저장 중'}</small></div>{!store.user&&<button className="profile-login" onClick={()=>{localStorage.removeItem('life:gate');setGate(null);}}>로그인</button>}<button className="icon-button" onClick={()=>go('settings')} aria-label="계정 설정"><MoreHorizontal size={18}/></button></div></div></aside>
 <div className="main-wrap"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={()=>setMenu(true)} aria-label="메뉴 열기"><Menu size={21}/></button><span>나의 워크스페이스</span><ChevronRight size={14}/><strong>{nav.find(n=>n.id===view)?.label??'설정'}</strong></div><div className="top-actions"><button className="sync-status" onClick={()=>go('settings')}>{store.user&&!demo?<Cloud size={15}/>:<CloudOff size={15}/>}<span>{store.status}</span></button><span className="top-divider"/><button className="icon-button" onClick={()=>go('settings')} aria-label="도움말과 백업"><CircleHelp size={18}/></button></div></header>
 <main>
 {demo&&<div className="demo-banner"><span><Sparkles size={15}/>가상 데이터로 둘러보는 공간이에요. 자유롭게 눌러보세요.</span><button onClick={()=>{store.startPersonal();notify('빈 개인 공간을 준비했어요. 첫 퀘스트를 만들어 보세요.');}}>내 공간 시작하기<ArrowRight size={14}/></button></div>}
 {store.error&&<div className="error-banner" role="alert"><span>{store.error}</span><button onClick={()=>store.setError('')} aria-label="알림 닫기"><X size={17}/></button></div>}
 {!ready&&<p role="status">기록을 불러오고 있어요…</p>}
 {view==='today'&&<>
 {sectionHead(new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date()),'오늘도, 나의 속도로','작은 한 걸음이 모여 내가 원하는 삶이 되어가요.',headAction)}
 <section className="panel power-panel"><div className="power-head"><div><span className="eyebrow"><Swords size={13}/>전투력</span><b className="power-value">{power}</b></div><p>퀘스트를 끝내면 분야 레벨이 오르고, 레벨이 오르면 능력치가 <b>+10</b> 점프해요.</p></div>
 <div className="stat-row">{statList(s).map(st=><div key={st.domain.id} className={`stat-chip ${st.domain.color}`}><span className="stat-name">{st.name}</span><b>{st.value}</b><small>Lv.{st.level}</small><div className="progress-track"><i style={{width:`${Math.max(3,st.progress*100)}%`}}/></div><em>다음까지 {st.remaining} XP</em></div>)}</div></section>
 <section className="chapter-hero"><div className="hero-copy"><span className="chapter-label"><Flag size={14}/>MY CHAPTER 01</span><h2>{s.chapter}</h2><p>완벽한 하루보다, 어제보다 조금 더 나다운 하루.<br/>지금의 나에게 맞는 다음 한 걸음을 찾아봐요.</p><button onClick={()=>go('plans')}>나의 플랜 살펴보기<ArrowRight size={16}/></button><div className="hero-progress"><span>쌓아온 작은 성취 <b>{done.length}개</b></span><span>진행 중 퀘스트 <b>{open.length}개</b></span></div></div><Landscape/></section>
 <div className="dashboard-columns"><div className="primary-column"><section className="panel focus-quest"><div className="panel-heading"><div><h2>오늘의 퀘스트</h2><p>하나만 봐요. 끝내면 다음이 나와요.</p></div><button className="icon-button" onClick={()=>setDialog({type:'quest'})} aria-label="퀘스트 추가"><Plus size={19}/></button></div>
 {fq?<>{(()=>{const d=s.domains.find(x=>x.id===fq.domainId)??s.domains[0];return <div className="focus-card">
  <span className="focus-meta"><i className={`dot ${d.color}`}/>{d.name}<b>·</b>{fq.minutes}분{fq.due<today()&&<em className="focus-late">지난 일정</em>}{fq.repeat!=='none'&&<span className="repeat-chip"><RefreshCw size={11}/>{fq.repeat==='daily'?'매일':'매주'}</span>}</span>
  <h3>{fq.title}</h3>
  {fq.criterion&&<p className="focus-criterion">{fq.criterion}</p>}
  <div className="focus-actions"><button className="primary focus-done" onClick={()=>toggle(fq)} disabled={!ready}><Check size={18}/>완료했어요<b>+{fq.xp} XP</b></button><button className="text-button" onClick={()=>setDialog({type:'quest',item:fq})}>고치기 / 미루기</button></div></div>;})()}
 {upNext&&<div className="next-teaser"><span>다음</span><strong>{upNext.title}</strong><em>+{upNext.xp} XP</em></div>}
 <button className="panel-footer-link" onClick={()=>go('quests')}>남은 퀘스트 {queue.length}개 모두 보기<ArrowRight size={15}/></button></>
 :<Empty title={actualToday?'오늘 할 건 다 끝냈어요':'다음 한 걸음을 골라볼까요?'} body={actualToday?'남은 퀘스트가 없어요. 아래 보너스를 받거나 쉬어가도 좋아요.':'10분 안에 할 수 있는 작은 행동부터 시작해요.'} action={<button className="secondary" onClick={()=>setDialog({type:'quest'})}>첫 퀘스트 만들기</button>}/>}
 {bonus&&<div className="bonus-card"><span className="bonus-tag"><Zap size={13}/>보너스 서브퀘스트</span><strong>{bonus.title}</strong><p>{bonus.criterion}</p><div className="bonus-actions"><button className="secondary" onClick={()=>change(s=>acceptSubQuest(s),`보너스를 받았어요 · ${bonus.title}`)} disabled={!ready}>받기<b>+{bonus.xp} XP</b></button><small>{bonus.minutes}분 · 오늘 걸 다 끝냈을 때만 열려요</small></div></div>}
 </section>
 <section className="growth-section"><div className="section-heading"><div><h2>조금씩 자라는 나</h2><p>각자의 속도로, 모든 분야가 자라고 있어요.</p></div><button className="text-button" onClick={()=>go('map')}>성장 지도<ArrowUpRight size={15}/></button></div>{domainCards(true)}</section>
 <section className="reflection-strip"><span className="reflection-icon"><BookOpen size={23}/></span><div><h3>잠깐 돌아보는 시간</h3><p>이번 주, 작지만 잘해낸 일은 무엇인가요?</p></div><button className="secondary" onClick={()=>setDialog({type:'review'})}>회고 남기기<ArrowRight size={15}/></button></section></div>
 <aside className="secondary-column"><section className="panel week-panel"><div className="panel-heading"><h2>이번 주의 발자국</h2><Badge>MY PACE</Badge></div><WeekDots quests={s.quests}/><div className="week-summary"><span>오늘 완료한 퀘스트</span><b>{actualToday}<small>개</small></b></div><p className="small-note">쉬어가는 날도 여정의 일부예요.</p></section>
 <section className="panel next-reward"><div className="panel-heading"><h2>다음 작은 선물</h2><Gift size={18}/></div><div className="gift-illustration"><Gift size={43} strokeWidth={1.3}/><Sparkles size={17}/></div>{(()=>{const r=s.rewards.find(r=>r.status==='wish');return r?<><h3>{r.title}</h3><p>{r.type==='real'?'나를 위한 현실 속 보상':'성장을 기억하는 나만의 배지'}</p><div className="reward-progress-label"><span>성장 경험치</span><b>{xp} / {r.requiredXp} XP</b></div><div className="progress-track"><i style={{width:`${Math.min(100,xp/Math.max(1,r.requiredXp)*100)}%`}}/></div></>:<><h3>나만의 보상을 골라봐요</h3><p>기다려지는 작은 즐거움을 만들어 보세요.</p></>;})()}<button className="secondary full" onClick={()=>go('rewards')}>보상함 열어보기<ArrowRight size={15}/></button></section>
 <section className="quote-card"><span>“</span><p>멀리 가는 힘은<br/>작은 걸음에서 시작돼요.</p><small>LIFE, ONE STEP AT A TIME</small></section></aside></div>
 </>}
 {view==='map'&&<>{sectionHead('MY GROWTH','나의 성장 지도','성장은 비교가 아니라, 내가 남긴 발자국이에요.',<button className="primary" onClick={()=>setDialog({type:'domain'})}><Plus size={17}/>분야 추가</button>)}{domainCards()}<section className="panel map-panel"><div className="panel-heading"><div><Badge color={activeDomain.color}>{activeDomain.name}</Badge><h2>나의 발자국, 다음 이정표</h2></div><span className="level-large">Lv. {currentLevel.level}</span></div><div className="map-road">{Array.from({length:5},(_,i)=>{const l=i+1,threshold=50*(l-1)*l,reached=xpOf(s,activeDomain.id)>=threshold;return <div className={`map-stop ${reached?'reached':''}`} key={l}><div className="map-node">{reached?<Check size={24}/>:<LockKeyhole size={20}/>}</div><strong>{['첫 발걸음','리듬 만들기','꾸준한 탐험','나만의 방식','단단한 성장'][i]}</strong><span>Lv. {l} · {threshold} XP</span></div>;})}</div><div className="map-caption"><Sprout size={18}/><span>다음 레벨까지 <b>{currentLevel.remaining} XP</b>. 레벨은 이 공간에서 쌓은 실행 경험을 나타내요.</span></div></section><section className="panel"><div className="panel-heading"><h2>{activeDomain.name}의 퀘스트</h2><button className="text-button" onClick={()=>setDialog({type:'quest'})}>추가<Plus size={15}/></button></div>{s.quests.filter(q=>q.domainId===activeDomain.id).slice(0,8).map(questRow)}{!s.quests.some(q=>q.domainId===activeDomain.id)&&<Empty title="첫 발자국을 남겨보세요" body="이 분야의 작은 퀘스트를 만들어 보세요."/>}</section></>}
 {view==='quests'&&<>{sectionHead('ONE STEP AT A TIME','나의 퀘스트','실행하고, 쉬어가고, 필요하면 더 작게 바꿔도 좋아요.',<button className="primary" onClick={()=>setDialog({type:'quest'})}><Plus size={17}/>퀘스트 만들기</button>)}<div className="toolbar"><div className="tabs">{[['all','전체'],['ready','진행 중'],['done','완료'],['paused','보류']].map(([k,l])=><button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{l}</button>)}</div><input className="search-input" aria-label="퀘스트 검색" placeholder="퀘스트 검색…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="panel">{s.quests.filter(q=>(filter==='all'||q.status===filter)&&q.title.includes(query)).map(questRow)}{!s.quests.some(q=>(filter==='all'||q.status===filter)&&q.title.includes(query))&&<Empty title="여기는 아직 여백이에요" body="작은 퀘스트를 추가하거나 다른 필터를 살펴보세요."/>}</div></>}
 {view==='plans'&&<>{sectionHead('MORE THAN ONE WAY','목표와 플랜 ABC','상황이 달라져도, 나에게 맞는 다음 길을 찾을 수 있도록.',<button className="primary" onClick={()=>setDialog({type:'plan'})}><Plus size={17}/>플랜 만들기</button>)}{s.plans.length>1&&(()=>{
  const sig=(p:Plan)=>evaluateTriggers(s,p).length>0;
  const used=s.domains.filter(d=>s.plans.some(p=>p.domainId===d.id));
  const tabs=[['all',`전체 ${s.plans.length}`],['signal',`신호 ${s.plans.filter(sig).length}`],
    ...used.map(d=>[d.id,`${d.name} ${s.plans.filter(p=>p.domainId===d.id).length}`])] as [string,string][];
  const allOpen=openPlans.length>=s.plans.length;
  return <div className="toolbar plan-toolbar">
   <div className="tabs">{tabs.map(([k,l])=><button key={k} className={planFilter===k?'active':''} onClick={()=>setPlanFilter(k)}>{l}</button>)}</div>
   <div className="plan-toolbar-right">
    <input className="search-input" aria-label="플랜 검색" placeholder="플랜 검색…" value={planQuery} onChange={e=>setPlanQuery(e.target.value)}/>
    <button className="secondary" onClick={()=>setOpenPlans(allOpen?[]:s.plans.map(p=>p.id))}>{allOpen?'모두 접기':'모두 펼치기'}</button>
   </div>
  </div>;})()}
 {!s.plans.length&&<section className="panel"><Empty title="한 가지 목표, 세 가지 길" body="원하는 결과를 정하고 기본·대체·최소 경로를 만들어 보세요." action={<button className="primary" onClick={()=>setDialog({type:'plan'})}>첫 플랜 만들기</button>}/></section>}{s.plans.length>0&&!visiblePlans.length&&<section className="panel"><Empty title="조건에 맞는 플랜이 없어요" body="필터를 바꾸거나 검색어를 지워 보세요."/></section>}
 {visiblePlans.map(p=><section key={p.id} className="plan-section panel"><div className="panel-heading"><div><Badge>{s.domains.find(d=>d.id===p.domainId)?.name}</Badge><h2>{p.title}</h2><p>목표 · {p.goal}</p>
  <div className="plan-summary"><span className="plan-now">지금 <b>{p.active}</b> · {p.branches.find(b=>b.key===p.active)?.title}</span>
   <span>퀘스트 {s.quests.filter(q=>q.planId===p.id).length}</span>
   {p.branches.some(b=>b.rule)&&<span>규칙 {p.branches.filter(b=>b.rule).length}</span>}</div></div>
  <div className="plan-head-actions">
   <button className="secondary" onClick={()=>setDialog({type:'plan',item:p})}>편집</button>
   <button className="icon-button" aria-expanded={planOpen(p)} aria-label={`${p.title} ${openPlans.includes(p.id)?'접기':'펼치기'}`}
     onClick={()=>setOpenPlans(x=>x.includes(p.id)?x.filter(y=>y!==p.id):[...x,p.id])}>
    {planOpen(p)?<ChevronDown size={17}/>:<ChevronRight size={17}/>}</button>
  </div></div>{(()=>{const fired=evaluateTriggers(s,p);if(!fired.length)return null;
 return <div className="plan-signal"><span className="plan-signal-icon"><Flag size={16}/></span>
  <div><strong>지금 전환 조건이 맞습니다</strong>
   {fired.map((x,i)=><p key={i}>{x.reason} — <b>{x.to} 경로</b>({p.branches.find(y=>y.key===x.to)?.title})</p>)}
   <small>신호일 뿐입니다. 바꿀지는 본인이 정합니다.</small></div>
  <button className="primary" onClick={()=>{const to=fired[0].to;
   change(s=>log({...s,plans:s.plans.map(x=>x.id===p.id?{...x,active:to}:x)},`${p.title} · ${p.active} → ${to} (조건 발동)`),`${to} 경로로 바꿨어요.`);}}>
   {fired[0].to} 경로로</button></div>;})()}
{planOpen(p)&&<><div className="plan-branches">{p.branches.map(b=>{const a=assessBranch(s,p,b.key);return <article key={b.key} className={`branch ${p.active===b.key?'selected':''}`}><div className="branch-header"><span className="branch-letter">{b.key}</span><Badge color={p.active===b.key?'sage':'neutral'}>{p.active===b.key?'현재 경로':b.key==='B'?'대체 경로':'선택 가능한 경로'}</Badge></div><h3>{b.title}</h3><p>{b.result}</p><div className="branch-metrics"><span>필요 자금<b>{won(a.cost)}</b></span><span>주간 시간<b>{b.hours}시간</b></span><span>예상 기간<b>{b.duration}일</b></span></div><div className={`condition ${a.state}`}><i/>{a.state==='ready'?'현재 기록상 자원 조건 충족':a.state==='unknown'?'기록을 더 확인해 주세요':'자원 조건을 조정해 주세요'}</div>{a.reasons.map(r=><small className="condition-reason" key={r}>{r}</small>)}<p className="transition-note"><ArrowRight size={14}/>{b.trigger||'전환 조건을 설정해 주세요.'}</p>{b.rule&&<p className="rule-chip"><Compass size={12}/>{ruleText(b.rule)}</p>}<button className={p.active===b.key?'secondary full':'primary full'} disabled={p.active===b.key} onClick={()=>{if(a.state!=='ready'&&!confirm('자원 조건이 충족되지 않았거나 미확인입니다. 이 경로를 선택해 검토를 이어갈까요?'))return;change(s=>log({...s,plans:s.plans.map(x=>x.id===p.id?{...x,active:b.key}:x)},`${p.title} · ${p.active} → ${b.key} 경로 전환`),'선택한 경로를 기록했어요.');}}>{p.active===b.key?'이 길로 가고 있어요':'이 경로 선택'}</button></article>;})}</div><div className="plan-footer"><span><CircleHelp size={15}/>성공률 미산정 · 자원 충족은 성공 확률과 달라요.</span><button className="text-button" onClick={()=>{setSimPlan(p.id);setSimCash(String(latest(s,'cash')?.value??''));setSimHours(String(latest(s,'hours')?.value??''));setSimOpen(true);}}>상황을 바꿔 비교하기<ArrowUpRight size={15}/></button></div></>}</section>)}</>}
 {view==='records'&&<>{sectionHead('KNOW WHERE YOU ARE','나의 기록','기준일과 함께 기록하면, 계획이 현실에 가까워져요.',headAction)}<div className="stat-grid">{(()=>{const pk=pokerNet(s);return pk&&<div className="panel stat-card poker-card"><span>포커 통장 순유출</span><strong>{won(pk.net)}</strong><small>나간 돈 {won(pk.out)} · 돌아온 돈 {won(pk.in)}{pk.latest?` · ${pk.latest}`:''}</small><em>게임 손익이 아니라 통장에서 오간 돈이에요.</em></div>;})()}
            {(['cash','spend','sleep','weight'] as const).map(k=>{const o=latest(s,k);return <div className="panel stat-card" key={k}><span>{kindNames[k]}</span><strong>{o?obsText(k,o.value):'미확인'}</strong><small>{o?`${o.date} · ${o.note||'직접 입력'}`:'첫 기록을 남겨보세요'}</small></div>;})}</div><section className="panel record-chart"><div className="panel-heading"><div><h2>현금의 흐름</h2><p>기록한 날짜의 잔액만 연결해요. 월간 적자 추정이 아닙니다.</p></div><Wallet size={20}/></div><CashChart observations={s.observations}/></section><section className="panel"><div className="panel-heading"><h2>기록 이력</h2><Badge color="neutral">{s.observations.length}개</Badge></div><div className="table-wrap"><table><thead><tr><th>기준일</th><th>항목</th><th>값</th><th>메모</th><th><span className="sr-only">삭제</span></th></tr></thead><tbody>{s.observations.map(o=><tr key={o.id}><td>{o.date}</td><td>{kindNames[o.kind]}</td><td><strong>{obsText(o.kind,o.value)}</strong></td><td>{o.note||'—'}</td><td><button className="icon-button" aria-label="기록 삭제" onClick={()=>{if(confirm('이 기록을 삭제할까요? 플랜 판정이 바뀔 수 있어요.'))change(s=>log({...s,observations:s.observations.filter(x=>x.id!==o.id)},`${kindNames[o.kind]} 기록 삭제`));}}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>{!s.observations.length&&<Empty title="지금의 나를 알아가는 첫 기록" body="현금, 가용시간, 수면 중 하나부터 적어보세요."/>}</section></>}
 {view==='review'&&<>{sectionHead('PAUSE & REFLECT','잠깐, 돌아보기','잘한 일은 기억하고, 어려웠던 일은 다음 계획의 힌트로.',<button className="primary" onClick={()=>setDialog({type:'review'})}><Plus size={17}/>회고 남기기</button>)}<section className="panel review-intro"><BookOpen size={30}/>{(()=>{const w=weekStats(s);return w.done?<p className="review-week">지난 7일 · 완료 <b>{w.done}</b> · 끝까지 <b>{w.full}</b> · 절반 <b>{w.partial}</b> · 못 함 <b>{w.missed}</b> · <b>+{w.xp} XP</b></p>:null;})()}<h2>이번 주의 나에게 한마디</h2><p>계획대로 되지 않은 일도 괜찮아요.<br/>무엇을 바꾸면 다음 한 걸음이 조금 쉬워질까요?</p></section>{s.reviews.map(r=><article className="panel review-card" key={r.id}><span className="eyebrow">{r.date}</span>{r.stats&&<div className="review-stats"><span>완료 <b>{r.stats.done}</b></span><span>끝까지 <b>{r.stats.full}</b></span><span>절반 <b>{r.stats.partial}</b></span><span>못 함 <b>{r.stats.missed}</b></span><span className="xp">+{r.stats.xp} XP</span></div>}<div><h3>작지만 잘해낸 일</h3><p>{r.win||'—'}</p><h3>어려웠던 점</h3><p>{r.obstacle||'—'}</p><h3>다음 주의 한 걸음</h3><p>{r.next||'—'}</p></div></article>)}{!s.reviews.length&&<p className="center muted">첫 회고가 이곳에 차곡차곡 쌓일 거예요.</p>}</>}
 {view==='rewards'&&<>{sectionHead('A LITTLE SOMETHING FOR YOU','나를 위한 보상함','성장을 기억하는 작은 배지, 일상을 즐겁게 하는 작은 선물.',<button className="primary" onClick={()=>setDialog({type:'reward'})}><Plus size={17}/>보상 추가</button>)}<div className="reward-budget panel"><div><span className="eyebrow">MY REWARD BUDGET</span><h2>보상 예산</h2><p>예약과 사용 금액을 제외한 남은 예산 <b>{rewardAvailable(s)===null?'미설정':won(rewardAvailable(s)!)}</b></p></div><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);change(s=>({...s,rewardBudget:num(f,'budget')}),'보상 예산을 저장했어요.');}}><label className="sr-only" htmlFor="budget">전체 보상 예산</label><input id="budget" name="budget" type="number" min="0" max="1000000000" required key={s.rewardBudget??'unset'} defaultValue={s.rewardBudget??''} placeholder="전체 예산 (원)"/><button className="secondary">예산 설정</button></form></div><p className="small-note">이 예산은 예약·사용 이력이 누적되는 전체 보상 예산이에요. 월별로 자동 초기화하지 않아요.</p><div className="reward-grid">{s.rewards.map(r=>{const unlocked=xp>=r.requiredXp;return <article className={`panel reward-card ${r.status==='used'?'used':''}`} key={r.id}><div className="reward-card-top"><Badge color={r.type==='digital'?'sage':'amber'}>{r.type==='digital'?'성장 배지':'현실 보상'}</Badge>{r.status==='used'?<CheckCheck size={20}/>:unlocked?<Sparkles size={19}/>:<LockKeyhole size={18}/>}</div><div className={`reward-art ${r.type==='digital'?'sage':'amber'}`}>{r.type==='digital'?<Sprout size={40} strokeWidth={1.4}/>:<Gift size={40} strokeWidth={1.4}/>}</div><h3>{r.title}</h3><p>{r.type==='real'?(r.cost?won(r.cost):'돈이 들지 않는 작은 즐거움'):'나의 발자국을 기억하는 배지'}</p><div className="reward-condition">{(()=>{const pg=rewardProgress(s,r);
 if(r.status==='used')return <>획득 · 사용 완료{r.usedAt&&<small> · {new Date(r.usedAt).toLocaleDateString('ko-KR')}</small>}</>;
 if(r.status==='reserved')return <>예약됨{r.reservedAt&&<small> · {new Date(r.reservedAt).toLocaleDateString('ko-KR')}</small>}</>;
 return <>{pg.unlocked?'잠금 해제 조건 달성':`${pg.remaining} XP 더 쌓으면 열려요`}<small> · {pg.scope}</small>
   <span className="reward-track"><i style={{width:`${Math.max(3,pg.ratio*100)}%`}}/></span></>;})()}</div>{r.note&&<p className="reward-note">{r.note}</p>}{r.status==='wish'&&<button className={unlocked?'primary full':'secondary full'} disabled={!unlocked} onClick={()=>{if(store.user&&!navigator.onLine){notify('현실 보상 예약은 온라인 연결 후 확정해 주세요.');return;}change(s=>reserveReward(s,r.id),r.type==='digital'?'새 배지를 획득했어요!':'보상을 예약했어요.');}}>{unlocked?(r.type==='digital'?'배지 받기':'보상 예약하기'):<><LockKeyhole size={14}/>다음 성취를 기다리는 중</>}</button>}{r.status==='reserved'&&<div className="button-row"><button className="primary" onClick={()=>{const input=prompt('실제로 사용한 금액을 입력해 주세요. (원)',String(r.cost));if(input===null)return;const spent=Number(input);if(!Number.isFinite(spent)||spent<0){notify('올바른 금액을 입력해 주세요.');return;}change(s=>log({...s,rewards:s.rewards.map(x=>x.id===r.id?{...x,status:'used',spent,usedAt:new Date().toISOString()}:x)},`${r.title} · 보상 사용 ${won(spent)}`),'사용을 기록했어요. 현금 잔액은 실제 잔액 기록으로 갱신해 주세요.');}}>사용 기록</button><button className="secondary" onClick={()=>change(s=>({...s,rewards:s.rewards.map(x=>x.id===r.id?{...x,status:'wish'}:x)}),'예약을 취소했어요.')}>취소</button></div>}{r.status==='used'&&<span className="used-label"><Check size={16}/>나의 여정에 남았어요</span>}</article>;})}</div>{!s.rewards.length&&<Empty title="무엇이 나를 즐겁게 할까요?" body="작은 활동, 물건, 배지까지 나만의 보상을 정해보세요."/>}
 {(()=>{const hist=s.rewards.filter(r=>r.status!=='wish').sort((a,b)=>String(b.usedAt??b.reservedAt??'').localeCompare(String(a.usedAt??a.reservedAt??'')));
  const spent=hist.filter(r=>r.status==='used').reduce((n,r)=>n+(r.spent??r.cost),0);
  const reserved=hist.filter(r=>r.status==='reserved').reduce((n,r)=>n+r.cost,0);
  return <section className="panel reward-history"><div className="panel-heading"><div><h2>받은 보상</h2><p>무엇을 언제 받았고 얼마를 썼는지 남습니다.</p></div><Badge color="neutral">{hist.length}개</Badge></div>
   {hist.length?<><div className="reward-sums"><div><span>사용한 금액</span><b>{won(spent)}</b></div><div><span>예약 중</span><b>{won(reserved)}</b></div><div><span>남은 예산</span><b>{rewardAvailable(s)===null?'미설정':won(rewardAvailable(s)!)}</b></div></div>
   <div className="table-wrap"><table><thead><tr><th>날짜</th><th>보상</th><th>종류</th><th>금액</th><th>상태</th></tr></thead><tbody>
    {hist.map(r=><tr key={r.id}><td>{(r.usedAt??r.reservedAt)?new Date(r.usedAt??r.reservedAt!).toLocaleDateString('ko-KR'):'—'}</td><td><strong>{r.title}</strong>{r.note&&<small> · {r.note}</small>}</td><td>{r.type==='digital'?'성장 배지':'현실 보상'}</td><td>{r.type==='digital'?'—':won(r.status==='used'?(r.spent??r.cost):r.cost)}</td><td>{r.status==='used'?'사용 완료':'예약됨'}</td></tr>)}
   </tbody></table></div></>:<p className="muted">아직 받은 보상이 없어요. 첫 보상을 정하고 성장으로 열어보세요.</p>}
  </section>;})()}</>}
 {view==='settings'&&<>{sectionHead('YOUR SPACE','설정과 동기화','내 기록을 안전하게 보관하고, 다른 기기에서도 이어가요.')}<div className="settings-grid"><section className="panel settings-panel"><h2><Cloud size={20}/>휴대폰 · PC 연결</h2><p>같은 계정으로 로그인하면 개인 공간이 자동으로 동기화돼요.</p>{!store.config&&<div className="notice">아직 클라우드 저장소가 연결되지 않았어요. 지금 기록은 이 기기에만 저장됩니다.</div>}{store.user?<><Badge>{store.user.email}</Badge><p>상태: {store.status}</p><div className="button-row"><button className="primary" onClick={()=>void store.sync()}>지금 동기화</button><button className="secondary" onClick={()=>store.logout().then(()=>{localStorage.removeItem('life:gate');setGate(null);}).catch(e=>notify(e.message))}>로그아웃</button></div></>:<form onSubmit={e=>{e.preventDefault();const run=authMode==='signup'?store.signup(authEmail,authPassword):store.login(authEmail,authPassword).then(()=>false);run.then(needsConfirm=>{setAuthPassword('');if(needsConfirm){setAuthSent(true);notify('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 다시 로그인해 주세요.');}else{setAuthSent(false);notify(authMode==='signup'?'계정을 만들고 로그인했어요.':'로그인했어요.');}}).catch(e=>notify(e.message));}}><Field label="이메일"><input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} required autoComplete="username" placeholder="name@example.com"/></Field><Field label="비밀번호"><input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required minLength={8} autoComplete={authMode==='signup'?'new-password':'current-password'} placeholder="8자 이상"/></Field><button className="primary" disabled={!store.config}>{authMode==='signup'?'계정 만들고 시작하기':'로그인'}<ArrowRight size={16}/></button><button type="button" className="text-button" onClick={()=>{setAuthMode(m=>m==='signup'?'login':'signup');setAuthSent(false);}}>{authMode==='signup'?'이미 계정이 있어요 · 로그인하기':'계정이 없어요 · 새로 만들기'}</button><p className="small-note">{authMode==='signup'?'휴대폰에서도 같은 이메일과 비밀번호로 로그인하면 두 기기가 같은 공간을 씁니다.':'처음이라면 아래에서 계정을 먼저 만들어 주세요.'}</p>{authSent&&<p className="small-note">메일의 확인 링크를 누른 뒤, 이 화면에서 같은 이메일과 비밀번호로 로그인해 주세요.</p>}</form>}<details className="advanced"><summary>동기화 서비스 연결 설정</summary><p className="small-note">본인이 관리하는 Supabase 프로젝트를 연결할 때만 입력하세요. 데이터는 해당 프로젝트로 전송됩니다. DB 설치 파일은 저장소의 app/supabase/schema.sql에 있습니다.</p><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{store.configure({url:text(f,'url'),key:text(f,'key')});notify('서비스를 연결했어요. 이메일로 로그인해 주세요.');}catch(e){notify((e as Error).message);}}}><Field label="프로젝트 URL"><input name="url" type="url" required defaultValue={store.config?.url??''} placeholder="https://project.supabase.co"/></Field><Field label="공개 publishable key"><input name="key" required defaultValue={store.config?.key??''} placeholder="sb_publishable_…" autoComplete="off"/></Field><button className="secondary">연결 저장</button></form></details><p className="small-note">로그인하면 계정별 공간을 불러옵니다. 기기 공간의 기존 기록을 옮기려면 로그인 전에 백업한 뒤 로그인 후 가져와 주세요.</p></section>
 <section className="panel settings-panel"><h2><ArrowDownToLine size={20}/>기록 보관</h2><p>백업 파일에는 현재 공간의 모든 기록이 담겨요. 기기를 바꾸기 전에도 한 번 저장해 두세요.</p><div className="button-row"><button className="primary" onClick={exportBackup}>백업 내려받기</button><button className="secondary" onClick={()=>importRef.current?.click()}>백업 가져오기</button></div><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={e=>void importFile(e.target.files?.[0])}/><hr/><h3>나의 공간</h3><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);change(s=>({...s,name:text(f,'name'),chapter:text(f,'chapter')}),'공간 이름을 바꿨어요.');}}><Field label="공간 이름"><input name="name" required maxLength={100} defaultValue={s.name} key={s.name}/></Field><Field label="현재 챕터"><input name="chapter" required maxLength={150} defaultValue={s.chapter} key={s.chapter}/></Field><button className="secondary">저장</button></form><hr/><button className="text-button" onClick={()=>demo?store.startPersonal():store.viewDemo()}>{demo?'내 개인 공간으로 이동':'가상 예시 다시 둘러보기'}<ArrowRight size={15}/></button><p className="small-note">예시 공간과 개인 기록은 분리돼 있어요. 예시의 변경은 저장되지 않습니다.</p></section></div><section className="panel settings-panel"><h2>최근 변경 이력</h2>{s.events.slice(0,12).map(e=><div className="event-row" key={e.id}><span>{e.text}</span><small>{new Date(e.at).toLocaleString('ko-KR')}</small></div>)}{!s.events.length&&<p className="muted">새로운 활동이 이곳에 기록됩니다.</p>}<p className="small-note">LIFE v0.1 · 실제 관측과 시뮬레이션을 구분합니다. 미래의 성공률은 근거가 쌓이기 전까지 미산정입니다.</p></section></>}
 <footer className="page-footer"><Sprout size={14}/><span>나의 삶은, 계속 자라는 중.</span><span>LIFE · ONE STEP AT A TIME</span></footer>
 </main></div>
 <nav className="mobile-nav">{[nav[0],nav[1],nav[3],nav[6]].map(n=><button key={n.id} className={view===n.id?'active':''} onClick={()=>go(n.id)}><n.icon size={20}/><span>{n.label}</span></button>)}</nav>
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
 {store.conflict&&<Modal title="다른 기기에서도 기록이 바뀌었어요" onClose={()=>notify('기록을 선택할 때까지 동기화가 잠시 멈춥니다.')}><p>한 공간의 전체 기록이 서로 다릅니다. 먼저 현재 기기 기록을 백업한 뒤, 유지할 버전을 선택해 주세요. 선택하지 않은 변경은 덮어써집니다.</p><div className="conflict-grid"><div><h3>이 기기</h3><p>퀘스트 {s.quests.length}개 · 기록 {s.observations.length}개</p></div><div><h3>서버</h3><p>퀘스트 {store.conflict.data.quests.length}개 · 기록 {store.conflict.data.observations.length}개</p></div></div><button className="secondary" onClick={exportBackup}>이 기기 기록 백업</button><div className="modal-actions"><button className="secondary" onClick={()=>void store.resolveConflict('remote')}>서버 기록 사용</button><button className="primary" onClick={()=>{if(confirm('서버 기록 전체를 이 기기의 기록으로 바꿀까요?'))void store.resolveConflict('local');}}>이 기기 기록 사용</button></div></Modal>}
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
 {dialog&&dialog.type!=='outcome'&&<Modal title={{quest:dialog.type==='quest'&&dialog.item?'퀘스트 다듬기':'새로운 작은 한 걸음',plan:'나의 플랜 ABC',observation:'지금의 나 기록하기',reward:'기다려지는 작은 보상',domain:'새로운 성장 분야',review:'이번 주의 나에게',import:'백업 가져오기',outcome:'오늘은 어디까지 갔나요?'}[dialog.type]} onClose={()=>setDialog(null)}>{dialog.type==='import'?<><p>가져올 공간: <b>{dialog.data.name}</b></p><p>퀘스트 {dialog.data.quests.length}개 · 기록 {dialog.data.observations.length}개</p><div className="notice">현재 공간 전체를 이 백업으로 바꿉니다. 로그인 상태에서는 연결된 클라우드에도 반영됩니다.</div><div className="modal-actions"><button className="secondary" onClick={exportBackup}>현재 기록 백업</button><button className="primary" onClick={()=>{change(()=>dialog.data,'백업 기록을 가져왔어요.');setDialog(null);}}>이 기록으로 교체</button></div></>:<form onSubmit={submit}>
 {dialog.type==='quest'&&<><Field label="어떤 한 걸음을 내딛을까요?"><input name="title" required maxLength={200} placeholder="예: 이번 달 정기결제 목록 확인하기" defaultValue={dialog.item?.title}/></Field><div className="form-grid"><Field label="분야">{domainSelect(dialog.item?.domainId)}</Field><Field label="예정일"><input type="date" name="due" required defaultValue={dialog.item?.due??today()}/></Field><Field label="예상 시간 (분)"><input name="minutes" type="number" min="0" max="10000" required defaultValue={dialog.item?.minutes??10}/></Field><Field label="경험치"><select name="xp" defaultValue={dialog.item?.xp??15}><option value="5">관측 · 5 XP</option><option value="15">실행 · 15 XP</option><option value="30">결과물 · 30 XP</option><option value="10">회고 · 10 XP</option></select></Field></div><Field label="완료했다고 말할 수 있는 기준"><textarea name="criterion" required maxLength={2000} placeholder="목록과 다음 결제일을 기록했어요." defaultValue={dialog.item?.criterion}/></Field><Field label="절반쯤 했다고 할 수 있는 기준 (선택)"><input name="partialCriterion" maxLength={2000} placeholder="목록은 봤지만 정리는 못 했어요." defaultValue={dialog.item?.partialCriterion??''}/></Field><Field label="반복"><select name="repeat" defaultValue={dialog.item?.repeat??'none'}><option value="none">한 번만</option><option value="daily">매일</option><option value="weekly">매주</option></select></Field><Field label="최소한 이것만은 (선택)"><input name="minimumCriterion" maxLength={2000} placeholder="앱을 열어 한 줄이라도 적었어요." defaultValue={dialog.item?.minimumCriterion??''}/></Field><Field label="연결할 플랜"><select name="plan" defaultValue={dialog.item?.planId??''}><option value="">연결하지 않음</option>{s.plans.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>{dialog.item&&<div className="button-row"><button type="button" className="secondary" onClick={()=>{change(s=>({...s,quests:s.quests.map(q=>q.id===dialog.item!.id?{...q,status:q.status==='paused'?'ready':'paused',completedAt:null}:q)}),'퀘스트 상태를 바꿨어요.');setDialog(null);}}>{dialog.item.status==='paused'?'다시 시작':'잠시 보류'}</button><button type="button" className="text-button danger" onClick={()=>{if(confirm('퀘스트를 삭제할까요? 완료 경험치도 제거됩니다.')){change(s=>log({...s,quests:s.quests.filter(q=>q.id!==dialog.item!.id)},'퀘스트 삭제'));setDialog(null);}}}>삭제</button></div>}</>}
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

