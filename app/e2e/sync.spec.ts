import {test,expect,type BrowserContext} from '@playwright/test';
import {createEmpty} from '../src/model';

test('two authenticated device caches exchange a quest and completion through the sync API',async({browser})=>{
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
 await a.getByRole('button',{name:'첫 퀘스트 만들기'}).click();await a.getByLabel('어떤 한 걸음을 내딛을까요?').fill('두 기기 연결 확인');await a.getByLabel('완료했다고 말할 수 있는 기준').fill('다른 기기에서 확인');await a.getByRole('button',{name:'저장하기',exact:true}).click();
 await expect(b.getByText('두 기기 연결 확인',{exact:true})).toBeVisible({timeout:15000});await b.getByRole('button',{name:/완료했어요/}).click();await b.getByRole('button',{name:/끝까지 했어요/}).click();
 await expect.poll(()=>row.data.quests.filter(q=>q.status==='done').length,{timeout:15000}).toBe(1);await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(a.getByText('1개',{exact:true}).first()).toBeVisible({timeout:15000});
 for(const context of contexts)await context.close();
});
