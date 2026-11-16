import {useState} from 'react';
import {type Workspace,completeQuest,today,uid,log} from './model';
import './daily.css';
export default function Home({s,onGo,update,ready}:{s:Workspace;onGo:(v:'sim'|'journal'|'planning')=>void;update:(f:(s:Workspace)=>Workspace)=>unknown;ready:boolean}){
 const [capacity,setCapacity]=useState(20),[small,setSmall]=useState(false),[error,setError]=useState('');
 const date=today(),key=`daily:${date}:`;
 const record=s.events.find(e=>e.text.startsWith(key));
 const active=s.decisions.find(d=>d.status==='active');
 const candidates=s.quests.filter(q=>q.status==='ready'&&q.due<=date);
 const q=candidates.find(q=>q.id===active?.actionId)??candidates.sort((a,b)=>a.minutes-b.minutes)[0];
 const reduced=small||!!q&&q.minutes>capacity;
 const title=q?(reduced?`${q.title} — 첫 ${Math.min(capacity,5)}분만`:q.title):(small?'잠깐 멈추고 지금 기분만 확인하기':'오늘 신경 쓰이는 일 하나만 떠올려 보기');
 const criterion=q?(reduced?(q.minimumCriterion||'관련 자료나 메모를 열고, 다음에 할 한 가지를 확인해요.'):q.criterion):(small?'지금 기분을 한 단어로 떠올려요. 입력하지 않아도 돼요.':'지금 가장 신경 쓰이는 일을 마음속으로 하나 골랐다면 충분해요. 적지 않아도 돼요.');
 function save(rest=false){try{update(w=>{
  if(w.events.some(e=>e.text.startsWith(key)))return w;
  let next=w;
  if(!rest&&q&&!reduced)next=completeQuest(w,q.id,'full');
  return log(next,`${key}${rest?'rest':reduced?'small':'done'}|${rest?'오늘은 쉬기':title}`);
 });}catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요.');}}
 return <section className="daily-home">
 <p className="daily-eyebrow">LIFE · 오늘 한 걸음</p><h1>{record?'오늘은 여기까지.':'오늘은 얼마나 여유 있어?'}</h1>
 <p className="daily-intro">{record?'더 채우지 않아도 괜찮아요. 내일 다시 시작해요.':'계획부터 세울 필요 없어요. 지금 가능한 만큼만 골라요.'}</p>
 {error&&<p role="alert">{error}</p>}
 {record?<article className="daily-card"><span className="daily-tag">오늘의 기록</span><h2>{record.text.includes(':rest|')?'오늘은 쉬기로 했어요':record.text.includes(':small|')?'작게 시작했어요':'한 걸음 남겼어요'}</h2><p>{record.text.split('|').slice(1).join('|')}</p></article>:<>
 <div className="daily-capacity" aria-label="오늘 여유">{[[5,'거의 없어'],[20,'20분 정도'],[40,'여유 있어']] .map(([n,label])=><button key={n} aria-pressed={capacity===n} onClick={()=>{setCapacity(Number(n));setSmall(false);}}>{label}</button>)}</div>
 <article className="daily-card"><span className="daily-tag">오늘 제안 · {q?Math.min(q.minutes,reduced?Math.min(capacity,5):capacity):1}분</span><h2>{title}</h2><p>{criterion}</p><p className="daily-reason">{active&&q?.id===active.actionId?`지금 목표: ${active.goal}`:q?'기존에 남긴 행동 중 지금 시작할 수 있는 일을 가져왔어요.':'아직 계획이 없어도 시작할 수 있어요. 목표 설정은 나중에 해도 돼요.'}</p><div className="daily-buttons"><button className="primary" disabled={!ready} onClick={()=>save()}>했어</button><button className="secondary" disabled={small} onClick={()=>setSmall(true)}>더 작게</button><button className="ghost" disabled={!ready} onClick={()=>save(true)}>오늘은 쉬기</button></div>{reduced&&q&&<small>작게 시작한 기록만 남기고, 원래 행동은 완료로 처리하지 않아요.</small>}</article></>}
 <button className="daily-note" onClick={()=>onGo('journal')}>상황이 달라졌어 · 한 줄 남기기 ↗</button>
 <details className="daily-more"><summary>큰 결정을 고민하고 있다면</summary><p>필요할 때만 기준값과 선택지를 살펴보세요.</p><button className="secondary" onClick={()=>onGo('sim')}>선택 비교</button><button className="ghost" onClick={()=>onGo('planning')}>상세 계획과 기록</button></details>
 </section>;
}
