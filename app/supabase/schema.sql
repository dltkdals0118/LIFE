-- Run once in your Supabase SQL editor. Only authenticated owners can read/write.
create table if not exists public.life_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists public.life_mutations (
 user_id uuid not null references auth.users(id) on delete cascade,
 mutation_id uuid not null,
 revision bigint not null,
 primary key(user_id,mutation_id)
);
alter table public.life_workspaces enable row level security;
alter table public.life_mutations enable row level security;
drop policy if exists life_owner_read on public.life_workspaces;
create policy life_owner_read on public.life_workspaces for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.life_workspaces from anon, authenticated;
grant select on public.life_workspaces to authenticated;
revoke all on public.life_mutations from anon, authenticated;

create or replace function public.save_life_workspace(expected_revision bigint,new_data jsonb,mutation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid:=auth.uid(); existing public.life_workspaces; seen bigint; next_revision bigint;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if octet_length(new_data::text)>4000000 or new_data->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(new_data->'quests') is distinct from 'array'
    or jsonb_typeof(new_data->'domains') is distinct from 'array' then raise exception 'Invalid workspace'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 select m.revision into seen from public.life_mutations m where m.user_id=owner_id and m.mutation_id=save_life_workspace.mutation_id;
 if found then return jsonb_build_object('conflict',false,'revision',seen); end if;
 select * into existing from public.life_workspaces where user_id=owner_id for update;
 if found then
   if existing.revision<>expected_revision then return jsonb_build_object('conflict',true,'revision',existing.revision,'data',existing.data); end if;
   next_revision:=existing.revision+1;
   update public.life_workspaces set data=new_data,revision=next_revision,updated_at=now() where user_id=owner_id;
 else
   if expected_revision<>0 then raise exception 'Workspace not found; restore from backup'; end if;
   next_revision:=1;
   insert into public.life_workspaces(user_id,data,revision) values(owner_id,new_data,next_revision);
 end if;
 insert into public.life_mutations(user_id,mutation_id,revision) values(owner_id,mutation_id,next_revision);
 return jsonb_build_object('conflict',false,'revision',next_revision);
end $$;
revoke all on function public.save_life_workspace(bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_life_workspace(bigint,jsonb,uuid) to authenticated;
