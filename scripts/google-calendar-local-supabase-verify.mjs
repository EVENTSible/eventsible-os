import { execFileSync } from 'node:child_process';

const url = process.env.SUPABASE_LOCAL_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const parsed = new URL(url);
if (!['127.0.0.1','localhost'].includes(parsed.hostname) || parsed.port !== '54322') throw Error('Only the disposable local database is permitted');
const owner = '10000000-0000-4000-8000-000000000099';
const generation = '20000000-0000-4000-8000-000000000099';
const entries = JSON.stringify([{event_id:'calendar-instance',title:'Synthetic appointment',all_day:true,starts_on:'2026-11-18',ends_on:'2026-11-19',visibility:'default',status:'confirmed'}]);
const sql = `
begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','${owner}','authenticated','authenticated','google-local@test.invalid','',now(),'','','','','{"role":"owner"}','{}',now(),now());
insert into public.os_google_calendar_connections(owner_user_id,refresh_token_ciphertext) values('${owner}',repeat('x',40));
insert into public.os_google_calendar_sources(owner_user_id,calendar_id,label,selected,share_busy) values('${owner}','test-calendar','Synthetic',true,true);
select public.os_google_calendar_apply('${owner}','test-calendar',null,'cursor-001','${generation}',true,'${entries}'::jsonb);
do $$ begin
 if (select count(*) from public.os_google_calendar_entries where owner_user_id='${owner}') <> 1 then raise exception 'initial sync missing'; end if;
end $$;
select public.os_google_calendar_apply('${owner}','test-calendar','cursor-001','cursor-002','${generation}',false,'${entries}'::jsonb);
do $$ begin
 if (select count(*) from public.os_google_calendar_entries where owner_user_id='${owner}') <> 1 then raise exception 'duplicate on replay'; end if;
 begin
   perform public.os_google_calendar_apply('${owner}','test-calendar','cursor-001','cursor-003','${generation}',false,'[]'::jsonb);
   raise exception 'stale sync was accepted';
 exception when serialization_failure then null;
 end;
 if (select sync_token from public.os_google_calendar_sources where owner_user_id='${owner}' and calendar_id='test-calendar') <> 'cursor-002' then raise exception 'cursor advanced after failed sync'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"${owner}","role":"authenticated","app_metadata":{"role":"owner"}}',true);
do $$ begin
 if jsonb_array_length(public.os_google_calendar_snapshot('2026-11-18','2026-11-19')) <> 1 then raise exception 'snapshot missing'; end if;
 begin perform count(*) from public.os_google_calendar_connections; raise exception 'credential table was readable';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000098","role":"authenticated","app_metadata":{"role":"staff"}}',true);
do $$ declare item jsonb; begin
 item := public.os_google_calendar_snapshot('2026-11-18','2026-11-19')->0;
 if item->>'title' <> 'Busy' or item->>'calendarId' is not null or item->>'location' is not null then raise exception 'staff privacy boundary failed'; end if;
end $$;
reset role;
rollback;
select case when exists(select 1 from public.os_google_calendar_connections where owner_user_id='${owner}') then 'ROLLBACK_FAILED' else 'ROLLBACK_OK' end;
`;
const output = execFileSync('psql',[url,'--no-password','--no-psqlrc','--quiet','--set','ON_ERROR_STOP=1','--tuples-only','--no-align'],{input:sql,encoding:'utf8',env:{...process.env,PGPASSWORD:process.env.PGPASSWORD ?? 'postgres'}});
if (!output.includes('ROLLBACK_OK')) throw Error('Google Calendar rollback not verified');
console.log('Disposable Google Calendar migration: replay, stale cursor, credential boundary and rollback verified.');
