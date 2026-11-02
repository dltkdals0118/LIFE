import {test,expect,type Page} from '@playwright/test';
import {createEmpty} from '../src/model';

// 로그인 화면을 실제 사용자 경로 그대로 통과시킨다.
// sync.spec 은 세션을 심어 이 화면을 건너뛰므로 '로그인이 안 된다'를 잡지 못한다.
const PROJECT='https://test-project.supabase.co';
const user={id:'22222222-2222-4222-8222-222222222222',email:'me@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-11-02T00:00:00Z'};

async function mock(page:Page,opts:{loginFails?:boolean;needsConfirm?:boolean;notConfirmed?:boolean}={}){
 const expires=Math.floor(Date.now()/1000)+3600;
 const encode=(o:object)=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const access_token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:expires,role:'authenticated'})}.test-signature`;
 const session={access_token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,expires_at:expires,user};
 const row={data:createEmpty(),revision:1};
 const calls={token:0,signup:0,recover:0,resend:0};
 await page.addInitScript(p=>localStorage.setItem('life:config',JSON.stringify({url:p,key:'sb_publishable_test_key'})),PROJECT);
 await page.route(`${PROJECT}/**`,async route=>{
  const req=route.request(),url=req.url();
  const headers={'access-control-allow-origin':'*','content-type':'application/json'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:200,headers:{...headers,'access-control-allow-headers':'*','access-control-allow-methods':'*'},body:''});return;}
  if(url.includes('/auth/v1/resend')){calls.resend++;await route.fulfill({status:200,headers,body:'{}'});return;}
  if(url.includes('/auth/v1/token')){
   calls.token++;
   if(opts.notConfirmed){await route.fulfill({status:400,headers,body:JSON.stringify({error:'invalid_grant',error_description:'Email not confirmed',message:'Email not confirmed'})});return;}
   if(opts.loginFails){await route.fulfill({status:400,headers,body:JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials',message:'Invalid login credentials'})});return;}
   await route.fulfill({status:200,headers,body:JSON.stringify(session)});return;}
  // 확인 메일이 필요한 가입은 세션 없이 user 만 돌아온다.
  if(url.includes('/auth/v1/signup')){calls.signup++;await route.fulfill({status:200,headers,body:JSON.stringify(opts.needsConfirm?user:session)});return;}
  if(url.includes('/auth/v1/recover')){calls.recover++;await route.fulfill({status:200,headers,body:'{}'});return;}
  if(url.includes('/auth/v1/')){await route.fulfill({status:200,headers,body:JSON.stringify(user)});return;}
  await route.fulfill({status:200,headers,body:JSON.stringify(row)});
 });
 return calls;
}

test('로그인 화면이 메인보다 먼저 나온다',async({page})=>{
 await mock(page);
 await page.goto('./');
 await expect(page.getByRole('heading',{name:'다시 만나 반가워요'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'오늘도, 나의 속도로'})).toHaveCount(0);
});

test('비밀번호로 로그인하면 메인으로 들어간다',async({page})=>{
 const calls=await mock(page);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await page.getByLabel('이메일').fill(user.email);
 await page.getByLabel('비밀번호',{exact:true}).fill('test-password-1234');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 await expect(page.getByRole('heading',{name:'오늘도, 나의 속도로'})).toBeVisible({timeout:15000});
 expect(calls.token).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});

test('비밀번호가 틀리면 한국어로 안내하고 메인으로 넘어가지 않는다',async({page})=>{
 await mock(page,{loginFails:true});
 await page.goto('./');
 await page.getByLabel('이메일').fill(user.email);
 await page.getByLabel('비밀번호',{exact:true}).fill('wrong-password-1');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('이메일 또는 비밀번호가 맞지 않습니다');
 await expect(page.getByRole('heading',{name:'오늘도, 나의 속도로'})).toHaveCount(0);
});

test('회원가입 — 확인이 다르면 막고, 맞으면 계정을 만든다',async({page})=>{
 const calls=await mock(page);
 await page.goto('./');
 await page.getByRole('tab',{name:'회원가입'}).click();
 await page.getByLabel('이메일').fill(user.email);
 await page.getByLabel('비밀번호',{exact:true}).fill('test-password-1234');
 await page.getByLabel('비밀번호 확인').fill('different-password');
 await page.getByRole('button',{name:'계정 만들기'}).click();
 await expect(page.getByRole('alert')).toContainText('두 비밀번호가 서로 다릅니다');
 expect(calls.signup).toBe(0);
 await page.getByLabel('비밀번호 확인').fill('test-password-1234');
 await page.getByRole('button',{name:'계정 만들기'}).click();
 await expect(page.getByRole('heading',{name:'오늘도, 나의 속도로'})).toBeVisible({timeout:15000});
 expect(calls.signup).toBeGreaterThan(0);
});

test('비밀번호 재설정 메일을 보낸다',async({page})=>{
 const calls=await mock(page);
 await page.goto('./');
 await page.getByRole('button',{name:'비밀번호를 잊으셨나요?'}).click();
 await expect(page.getByRole('heading',{name:'비밀번호 재설정'})).toBeVisible();
 await page.getByLabel('이메일').fill(user.email);
 await page.getByRole('button',{name:'재설정 메일 받기'}).click();
 await expect(page.getByText('재설정 메일을 보냈어요.',{exact:false})).toBeVisible({timeout:15000});
 expect(calls.recover).toBeGreaterThan(0);
});

test('로그인 없이 둘러보기와 기기 저장 경로가 모두 열린다',async({page})=>{
 await mock(page);
 await page.goto('./');
 await page.getByRole('button',{name:'로그인 없이 둘러보기'}).click();
 await expect(page.getByRole('heading',{name:'오늘도, 나의 속도로'})).toBeVisible();
 await page.evaluate(()=>{localStorage.removeItem('life:gate');localStorage.removeItem('life:mode');});
 await page.reload();
 await page.getByRole('button',{name:'이 기기에만 저장하고 시작하기'}).click();
 await expect(page.getByRole('heading',{name:'오늘도, 나의 속도로'})).toBeVisible();
});

test('확인 메일이 필요한 가입이면 안내와 재전송 버튼이 나온다',async({page})=>{
 const calls=await mock(page,{needsConfirm:true});
 await page.goto('./');
 await page.getByRole('tab',{name:'회원가입'}).click();
 await page.getByLabel('이메일').fill(user.email);
 await page.getByLabel('비밀번호',{exact:true}).fill('test-password-1234');
 await page.getByLabel('비밀번호 확인').fill('test-password-1234');
 await page.getByRole('button',{name:'계정 만들기'}).click();
 await expect(page.getByText('확인 메일을 보냈어요.',{exact:false})).toBeVisible({timeout:15000});
 await expect(page.getByText('스팸함',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:/확인 메일 다시 보내기/}).click();
 await expect(page.getByText('확인 메일을 다시 보냈어요.',{exact:false})).toBeVisible({timeout:15000});
 expect(calls.resend).toBeGreaterThan(0);
});

test('이메일 미확인으로 로그인이 막히면 한국어로 알리고 재전송을 띄운다',async({page})=>{
 const calls=await mock(page,{notConfirmed:true});
 await page.goto('./');
 await page.getByLabel('이메일').fill(user.email);
 await page.getByLabel('비밀번호',{exact:true}).fill('test-password-1234');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('이메일 확인이 아직 끝나지 않았습니다');
 await page.getByRole('button',{name:/확인 메일 다시 보내기/}).click();
 expect(calls.resend).toBeGreaterThan(0);
});

// 2026-11-02 회귀 방지: 밝은 테마의 `background:#fff` 가 구체성으로 다크 테마를 이겨
// 입력 중인 글자가 보이지 않았다. 사람이 눈으로 보고 세 번 되돌아왔다 — 이제 기계가 잡는다.
test('입력칸은 포커스해도 어둡고 글자가 읽힌다',async({page})=>{
 await mock(page);
 await page.goto('./');
 const email=page.getByLabel('이메일');
 await email.click();
 await email.fill('dltkdals0118@example.com');
 const read=(prop:string)=>email.evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),prop);
 const sum=(s:string)=>(s.match(/\d+/g)??['255','255','255']).slice(0,3).reduce((a,b)=>a+Number(b),0);
 const bg=await read('background-color');
 const fg=await read('color');
 // 배경은 거의 검정(합 150 미만), 글자는 밝아야(합 450 초과) 읽힌다
 expect(sum(bg),`포커스된 입력칸 배경이 밝다: ${bg}`).toBeLessThan(150);
 expect(sum(fg),`입력 글자가 어둡다: ${fg}`).toBeGreaterThan(450);
});
