import {test,expect} from '@playwright/test';
import {createEmpty} from '../src/model';

// 비밀번호 로그인 폼을 실제로 통과시키는 시험.
// sync.spec 은 세션을 localStorage 에 심어 폼을 건너뛴다 — 그래서 '로그인이 안 된다'를 잡지 못했다.
test('password sign-in connects the account and the app shows it',async({page},info)=>{
 test.skip(info.project.name!=='desktop','설정 진입 경로가 레이아웃마다 달라 데스크톱에서만 검증한다');
 const user={id:'22222222-2222-4222-8222-222222222222',email:'me@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-11-02T00:00:00Z'};
 const expires=Math.floor(Date.now()/1000)+3600;
 const encode=(o:object)=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const access_token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:expires,role:'authenticated'})}.test-signature`;
 const row={data:createEmpty(),revision:1};
 let passwordGrants=0;
 await page.addInitScript(()=>{localStorage.setItem('life:config',JSON.stringify({url:'https://test-project.supabase.co',key:'sb_publishable_test_key'}));});
 await page.route('https://test-project.supabase.co/**',async route=>{
  const req=route.request();const headers={'access-control-allow-origin':'*','content-type':'application/json'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:200,headers:{...headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'},body:''});return;}
  let result:unknown=row;
  if(req.url().includes('/auth/v1/token')){passwordGrants++;result={access_token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,expires_at:expires,user};}
  else if(req.url().includes('/auth/v1/'))result=user;
  else if(req.url().includes('/rpc/save_life_workspace'))result={conflict:false,revision:row.revision+1};
  await route.fulfill({status:200,headers,body:JSON.stringify(result)});
 });
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await page.getByRole('button',{name:'설정과 동기화'}).click();
 await expect(page.getByRole('heading',{name:'휴대폰 · PC 연결'})).toBeVisible();
 await page.getByLabel('이메일').fill(user.email);
 await page.getByLabel('비밀번호').fill('test-password-1234');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 // 로그인되면 계정 이메일이 보이고 로그아웃이 가능해진다 — 매직링크 때는 여기까지 오지 못했다.
 await expect(page.getByText(user.email,{exact:true})).toBeVisible({timeout:15000});
 await expect(page.getByRole('button',{name:'로그아웃',exact:true})).toBeVisible();
 expect(passwordGrants).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});

test('sign-up mode asks for a password and switches back to sign-in',async({page},info)=>{
 test.skip(info.project.name!=='desktop','위와 같은 이유');
 await page.addInitScript(()=>{localStorage.setItem('life:config',JSON.stringify({url:'https://test-project.supabase.co',key:'sb_publishable_test_key'}));});
 await page.goto('./');
 await page.getByRole('button',{name:'설정과 동기화'}).click();
 await page.getByRole('button',{name:'계정이 없어요 · 새로 만들기'}).click();
 await expect(page.getByRole('button',{name:'계정 만들고 시작하기'})).toBeVisible();
 await expect(page.getByLabel('비밀번호')).toHaveAttribute('minlength','8');
 await page.getByRole('button',{name:'이미 계정이 있어요 · 로그인하기'}).click();
 await expect(page.getByRole('button',{name:'로그인',exact:true})).toBeVisible();
});
