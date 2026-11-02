import { useEffect, useRef, useState } from 'react';
import { get, set, del } from 'idb-keyval';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createDemo, createEmpty, parseBackup, uid, type Workspace } from './model';

export type Config={url:string;key:string};
type Envelope={data:Workspace;revision:number;dirty:boolean;requestId:string};
const fresh=(data:Workspace):Envelope=>({data,revision:0,dirty:false,requestId:uid()});
export function configFromStorage():Config|null{try{const c=JSON.parse(localStorage.getItem('life:config')||'null');if(c)return c;const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;return url&&key?{url,key}:null;}catch{return null;}}
export function validConfig(c:Config){const u=new URL(c.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.pathname!=='/'||u.search||u.username)throw Error('https://프로젝트.supabase.co 형식의 프로젝트 URL을 입력해 주세요.');if(!c.key.startsWith('sb_publishable_')){try{const payload=JSON.parse(atob(c.key.split('.')[1]));if(payload.role!=='anon')throw Error();}catch{throw Error('공개 publishable key 또는 anon key만 사용할 수 있습니다. 비밀 키를 입력하지 마세요.');}}}
export function useWorkspace(){
 const [recovery,setRecovery]=useState(false);
 const [data,setData]=useState<Workspace>(createDemo),[demo,setDemo]=useState(localStorage.getItem('life:mode')!=='personal'),[config,setConfig]=useState<Config|null>(configFromStorage),[user,setUser]=useState<{id:string;email?:string}|null>(null),[status,setStatus]=useState('예시 공간'),[ready,setReady]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState<Envelope|null>(null);
 const client=useRef<SupabaseClient|null>(null),current=useRef<Envelope>(fresh(data)),scope=useRef(''),epoch=useRef(0),busy=useRef(false),writeChain=useRef(Promise.resolve()),conflictRef=useRef<Envelope|null>(null);
 const persist=(key:string,value:Envelope)=>{writeChain.current=writeChain.current.catch(()=>{}).then(()=>set(key,value)).catch(()=>{setError('기기 저장에 실패했습니다. 백업을 내려받아 주세요.');});return writeChain.current;};
 const show=(e:Envelope)=>{current.current=e;setData(e.data);};
 const conflictSet=(e:Envelope|null)=>{conflictRef.current=e;setConflict(e);};
 useEffect(()=>{if(!config)return;const c=createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});client.current=c;let alive=true;c.auth.getSession().then(({data,error})=>{if(!alive)return;if(error)setError(error.message);setUser(data.session?.user??null);});const {data:listener}=c.auth.onAuthStateChange((event,session)=>{if(!alive)return;setUser(session?.user??null);if(event==='PASSWORD_RECOVERY')setRecovery(true);});return()=>{alive=false;listener.subscription.unsubscribe();c.auth.stopAutoRefresh();client.current=null;};},[config]);
 useEffect(()=>{const gen=++epoch.current;busy.current=false;conflictSet(null);setReady(false);if(demo){scope.current='demo';show(fresh(createDemo()));setStatus('예시 공간');setReady(true);return;}
 const key=user?`life:workspace:${user.id}`:'life:workspace:guest';scope.current=key;
 get<Envelope>(key).then(saved=>{if(gen!==epoch.current)return;if(saved)parseBackup(saved.data);show(saved??fresh(createEmpty()));setReady(true);setStatus(user?(saved?.dirty?'전송 대기':'연결 중'):'이 기기에 저장');}).catch(()=>{if(gen!==epoch.current)return;setError('저장된 데이터 형식을 읽지 못했습니다. 기존 데이터는 유지됩니다.');setReady(false);});
 },[demo,user?.id]);
 async function sync(){const c=client.current;if(!c||!user||demo||!ready||busy.current||conflictRef.current)return;if(!navigator.onLine){setStatus('오프라인 · 전송 대기');return;}busy.current=true;const gen=epoch.current,key=scope.current,env=current.current;
 try{setStatus(env.dirty?'동기화 중':'확인 중');if(env.dirty){const {data:result,error}=await c.rpc('save_life_workspace',{expected_revision:env.revision,new_data:env.data,mutation_id:env.requestId});if(error)throw error;if(gen!==epoch.current)return;
 if(result.conflict){const remote:Envelope={...fresh(parseBackup(result.data)),revision:result.revision};conflictSet(remote);setStatus('충돌 확인 필요');return;}
 const next=current.current.requestId===env.requestId?{...env,revision:result.revision,dirty:false}:{...current.current,revision:result.revision};show(next);await persist(key,next);setStatus(next.dirty?'전송 대기':'동기화됨');
 }else{const {data:row,error}=await c.from('life_workspaces').select('data,revision').eq('user_id',user.id).maybeSingle();if(error)throw error;if(gen!==epoch.current)return;if(current.current.requestId!==env.requestId){setStatus('전송 대기');return;}if(row&&row.revision!==env.revision){const next={...fresh(parseBackup(row.data)),revision:row.revision};show(next);await persist(key,next);}setStatus('동기화됨');}
 }catch(e){if(gen===epoch.current){setStatus('연결 확인 필요');setError(e instanceof Error?e.message:(e as {message?:string})?.message||'동기화에 실패했습니다. 기기 기록은 유지됩니다.');}}finally{if(gen===epoch.current)busy.current=false;}}
 const syncRef=useRef(sync);syncRef.current=sync;
 useEffect(()=>{if(!ready||demo||!user)return;void syncRef.current();const timer=setInterval(()=>void syncRef.current(),5000);const focus=()=>void syncRef.current();window.addEventListener('online',focus);window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('online',focus);window.removeEventListener('focus',focus);};},[ready,demo,user?.id]);
 function update(fn:(s:Workspace)=>Workspace){if(!ready)throw Error('기록을 불러오는 중입니다.');const next=parseBackup(fn(current.current.data));const env={...current.current,data:next,dirty:!demo,requestId:uid()};show(env);if(!demo){void persist(scope.current,env);setStatus(user?'전송 대기':'이 기기에 저장');setTimeout(()=>void syncRef.current(),150);}return next;}
 function startPersonal(){localStorage.setItem('life:mode','personal');setDemo(false);}
 function viewDemo(){localStorage.setItem('life:mode','demo');setDemo(true);}
 function configure(c:Config){validConfig(c);if(current.current.dirty&&user)throw Error('전송 대기 기록을 먼저 동기화하거나 백업해 주세요.');localStorage.setItem('life:config',JSON.stringify(c));setConfig(c);}
 // 비밀번호 로그인. 매직링크는 기기를 추가할 때마다 메일을 기다려야 하고 무료 플랜은 시간당 2통이라
 // 두 기기를 묶는 데 쓸 수 없었다(2026-11-02 사용자 요청).
 async function login(email:string,password:string){if(!client.current)throw Error('동기화 서비스를 먼저 연결해 주세요.');const {error}=await client.current.auth.signInWithPassword({email,password});if(error)throw error;startPersonal();}
 // 반환값 true = 메일 확인이 필요하다(Supabase 의 Confirm email 이 켜져 있을 때). false = 바로 로그인됐다.
 async function signup(email:string,password:string){if(!client.current)throw Error('동기화 서비스를 먼저 연결해 주세요.');if(password.length<8)throw Error('비밀번호는 8자 이상으로 정해 주세요.');const {data,error}=await client.current.auth.signUp({email,password});if(error)throw error;startPersonal();return !data.session;}
 // 비밀번호 재설정 메일. 돌아오는 주소는 Supabase 의 Redirect URLs 에 등록돼 있어야 한다.
 async function resetPassword(email:string){if(!client.current)throw Error('동기화 서비스를 먼저 연결해 주세요.');const {error}=await client.current.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}${import.meta.env.BASE_URL}`});if(error)throw error;}
 // 재설정 링크로 돌아온 뒤 새 비밀번호를 정한다.
 async function updatePassword(password:string){if(!client.current)throw Error('동기화 서비스를 먼저 연결해 주세요.');if(password.length<8)throw Error('비밀번호는 8자 이상으로 정해 주세요.');const {error}=await client.current.auth.updateUser({password});if(error)throw error;setRecovery(false);}
 async function logout(){if(current.current.dirty)throw Error('전송 대기 기록이 있습니다. 동기화 후 로그아웃해 주세요.');const key=scope.current;const {error}=await client.current!.auth.signOut();if(error)throw error;await del(key);}
 async function resolveConflict(choice:'local'|'remote'){const remote=conflictRef.current;if(!remote)return;if(choice==='remote'){show(remote);await persist(scope.current,remote);}else{const next={...current.current,revision:remote.revision,dirty:true,requestId:uid()};show(next);await persist(scope.current,next);}conflictSet(null);setTimeout(()=>void syncRef.current(),0);}
 return {data,demo,ready,user,status,error,setError,conflict,update,startPersonal,viewDemo,config,configure,login,signup,resetPassword,updatePassword,recovery,logout,resolveConflict,sync:()=>syncRef.current()};
}
