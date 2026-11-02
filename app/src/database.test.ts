import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { createEmpty } from './model';
let db:PGlite;
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function asUser(user:string){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`);}
async function save(revision:number,id:string,name='test'){const data={...createEmpty(),name};const result=await db.query<{result:{conflict:boolean;revision:number;data?:{name:string}}}>('select public.save_life_workspace($1,$2::jsonb,$3::uuid) as result',[revision,JSON.stringify(data),id]);return result.rows[0].result;}
it('serializes saves, deduplicates retries, detects concurrent edits and enforces account isolation',async()=>{
 await asUser(alice);const request='33333333-3333-4333-8333-333333333333';expect(await save(0,request,'alice')).toEqual({conflict:false,revision:1});expect(await save(0,request,'alice')).toEqual({conflict:false,revision:1});
 const stale=await save(0,'44444444-4444-4444-8444-444444444444','stale');expect(stale.conflict).toBe(true);expect(stale.data?.name).toBe('alice');
 expect(await save(1,'55555555-5555-4555-8555-555555555555','new')).toEqual({conflict:false,revision:2});
 await asUser(bob);expect((await db.query('select * from public.life_workspaces')).rows).toHaveLength(0);await expect(db.exec(`update public.life_workspaces set data='{}' where user_id='${alice}'`)).rejects.toThrow();
 expect(await save(0,'66666666-6666-4666-8666-666666666666','bob')).toEqual({conflict:false,revision:1});expect((await db.query<{user_id:string}>('select user_id from public.life_workspaces')).rows.map(x=>x.user_id)).toEqual([bob]);
 await asUser('');await expect(save(0,'77777777-7777-4777-8777-777777777777')).rejects.toThrow('Authentication required');
});
