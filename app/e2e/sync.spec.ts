import {test,expect,type Page,type BrowserContext} from '@playwright/test';
// 모바일에선 사이드바와 하단 탭에 같은 이름이 둘 다 있다 — 보이는 쪽을 쓴다.
const navOf=async(p:Page)=>(await p.locator('.mobile-nav').isVisible())?'.mobile-nav':'.sidebar nav';
import {createEmpty} from '../src/model';

test('two authenticated device caches exchange a journal entry through the sync API',async({browser})=>{
 const user={id:'11111111-1111-4111-8111-111111111111',email:'test@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const expires=Math.floor(Date.now()/1000)+3600;
 const encode=(o:object)=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const access_token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:expires,role:'authenticated'})}.test-signature`;
 let row={data:createEmpty(),revision:1};const seen=new Map<string,number>();
 const contexts:BrowserContext[]=[];
 for(let i=0;i<2;i++){
  const context=await browser.newContext();contexts.push(context);
  await context.addInitScript(({user,access_token,expires})=>{localStorage.setItem('life:mode','personal');localStorage.setItem('life:config',JSON.stringify({url:'https://test-project.supabase.co',key:'sb_publishable_test_key'}));localStorage.setItem('sb-test-project-auth-token',JSON.stringify({access_token,refresh_token:'test-refresh',token_type:'bearer',expires_at:expires,expires_in:3600,user}));},{user,access_token,expires});
  await context.route('https://test-project.supabase.co/**',async route=>{const req=route.request();const headers={'access-control-allow-origin':'*','content-type':'application/json'};if(req.method()==='OPTIONS'){await route.fulfill({status:200,headers:{...headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'},body:''});return;}
   let result:unknown;
   if(req.url().includes('/auth/v1/'))result=user;
   else if(req.url().includes('/rpc/save_life_workspace')){const payload=req.postDataJSON();if(seen.has(payload.mutation_id))result={conflict:false,revision:seen.get(payload.mutation_id)};else if(payload.expected_revision!==row.revision)result={conflict:true,...row};else{row={data:payload.new_data,revision:row.revision+1};seen.set(payload.mutation_id,row.revision);result={conflict:false,revision:row.revision};}}
   else result=row;
   await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
 }
 const a=await contexts[0].newPage(),b=await contexts[1].newPage();
 await a.goto('http://127.0.0.1:4173/LIFE/');await b.goto('http://127.0.0.1:4173/LIFE/');await expect(a.getByRole('button',{name:'동기화됨',exact:true})).toBeVisible({timeout:15000});
 // 퀘스트가 없어졌으므로 일기로 두 기기를 잇는다 (2026-11-09 개편)
 await a.locator(await navOf(a)).getByRole('button',{name:'일기'}).click();
 await a.getByLabel('오늘의 일기').fill('두 기기 연결 확인');
 await a.getByRole('button',{name:'저장'}).click();
 await expect.poll(()=>row.data.journal.length,{timeout:15000}).toBe(1);
 await b.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await b.locator(await navOf(b)).getByRole('button',{name:'일기'}).click();
 await expect(b.getByLabel('오늘의 일기')).toHaveValue('두 기기 연결 확인',{timeout:15000});
 for(const context of contexts)await context.close();
});
