-- Only run through the loopback-guarded verifier against disposable Supabase.
begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-0000-0000-000000000000','19000000-0000-4000-8000-000000000001','authenticated','authenticated','owner-opportunity@example.invalid','',now(),'','','','','{"role":"owner"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','19000000-0000-4000-8000-000000000002','authenticated','authenticated','manager-opportunity@example.invalid','',now(),'','','','','{"role":"manager"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','19000000-0000-4000-8000-000000000003','authenticated','authenticated','staff-opportunity@example.invalid','',now(),'','','','','{"role":"staff"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','19000000-0000-4000-8000-000000000004','authenticated','authenticated','client-opportunity@example.invalid','',now(),'','','','','{"role":"client"}','{}',now(),now());
insert into public.os_profiles(id,display_name) values
('19000000-0000-4000-8000-000000000001','Synthetic Owner'),
('19000000-0000-4000-8000-000000000002','Synthetic Manager'),
('19000000-0000-4000-8000-000000000003','Synthetic Staff');
insert into storage.objects(bucket_id,name,owner_id,metadata)
values('opportunity-evidence','intake/29000000-0000-4000-8000-000000000001.png',
  '19000000-0000-4000-8000-000000000001','{"size":128,"mimetype":"image/png"}'::jsonb);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"owner"}}',true);
do $test$
declare
  v_payload jsonb := '{
    "source":"gigsalad","threadUrl":"https://www.gigsalad.com/synthetic-opportunity-ci",
    "contactId":"","clientName":"Synthetic Client","email":"opportunity-ci@example.invalid","phone":"",
    "eventType":"Synthetic Party","eventDate":"2027-02-12","venue":"Synthetic Venue","city":"South Bend",
    "summary":"Synthetic DJ event","originalMessage":"Test inquiry","originalReply":"Synthetic sent quote",
    "quoteState":"confirmed_sent","quoteAmount":"425","deposit":"105","serviceOptions":"DJ and microphone",
    "sentAt":"2026-11-17T19:00:00Z","assignee":"","dueAt":"2027-02-01T12:00:00Z",
    "priority":"normal","screenshotPath":"intake/29000000-0000-4000-8000-000000000001.png",
    "screenshotType":"image/png","screenshotName":"synthetic.png"}'::jsonb;
  v_first jsonb;
  v_duplicate jsonb;
begin
  v_first := public.os_create_opportunity('29000000-0000-4000-8000-000000000001',v_payload);
  if v_first->>'status' <> 'created' or v_first is distinct from
     public.os_create_opportunity('29000000-0000-4000-8000-000000000001',v_payload) then
    raise exception 'Intake was not idempotent';
  end if;
  if (select count(*) from public.os_leads where id=(v_first->>'leadId')::uuid) <> 1
    or (select count(*) from public.os_quote_versions where lead_id=(v_first->>'leadId')::uuid
       and status='sent' and total_amount=425 and deposit_amount=105) <> 1
    or (select count(*) from public.os_tasks where lead_id=(v_first->>'leadId')::uuid) <> 1
    or (select count(*) from public.os_files where event_id=(v_first->>'eventId')::uuid
       and bucket_id='opportunity-evidence' and visibility='staff_only') <> 1
    or (select count(*) from public.os_activity_events where event_id=(v_first->>'eventId')::uuid
       and event_type='opportunity.intake_created' and visibility='staff') <> 1 then
    raise exception 'Canonical intake, quote, task, file or activity missing';
  end if;
  begin
    perform public.os_create_opportunity('29000000-0000-4000-8000-000000000002',
      v_payload || '{"email":"different@example.invalid","screenshotPath":""}'::jsonb);
    raise exception 'Duplicate thread was accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.os_create_opportunity('29000000-0000-4000-8000-000000000003',
      v_payload || '{"threadUrl":"https://www.gigsalad.com/synthetic-invalid-ci",
        "email":"invalid-quote@example.invalid","originalReply":"","screenshotPath":""}'::jsonb);
    raise exception 'Unverified sent reply was accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists(select 1 from public.os_contacts where primary_email in
    ('different@example.invalid','invalid-quote@example.invalid')) then
    raise exception 'Failed intake left partial canonical records';
  end if;
end;
$test$;
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"client"}}',true);
do $test$
begin
  if exists(select 1 from public.os_activity_events where event_type='opportunity.intake_created')
    or exists(select 1 from public.os_files where bucket_id='opportunity-evidence')
    or exists(select 1 from storage.objects where bucket_id='opportunity-evidence') then
    raise exception 'Client can read private inquiry or screenshot evidence';
  end if;
end;
$test$;
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"staff"}}',true);
do $test$
begin
  begin
    perform public.os_create_opportunity('29000000-0000-4000-8000-000000000004',
      '{"source":"gigsalad"}'::jsonb);
    raise exception 'Staff could create an Owner-only opportunity';
  exception when insufficient_privilege then null;
  end;
end;
$test$;
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"manager"}}',true);
do $test$
begin
  begin
    perform public.os_create_opportunity('29000000-0000-4000-8000-000000000005',
      '{"source":"gigsalad"}'::jsonb);
    raise exception 'Manager could create an Owner-only opportunity';
  exception when insufficient_privilege then null;
  end;
end;
$test$;
rollback;
