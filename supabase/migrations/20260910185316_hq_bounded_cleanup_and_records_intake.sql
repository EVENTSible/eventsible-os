-- EVENTSible Owner-reviewed cleanup executor and archive-safe record surfaces.
-- The approved manifest remains outside Git. Its exact file bytes are verified
-- before any target identifier is accepted by the database.

alter table public.os_integration_outbox
  drop constraint os_integration_outbox_status_chk,
  add constraint os_integration_outbox_status_chk check (
    status in ('pending', 'processing', 'processed', 'retry', 'failed', 'dead_letter', 'quarantined')
  );

alter table public.os_automation_outbox
  drop constraint os_automation_outbox_status_check,
  add constraint os_automation_outbox_status_check check (
    status in ('pending', 'processing', 'completed', 'failed', 'cancelled', 'quarantined')
  );

create table public.os_cleanup_manifest_scopes (
  manifest_hash text primary key,
  contract_version text not null,
  contact_count integer not null,
  lead_count integer not null,
  event_count integer not null,
  integration_outbox_count integer not null,
  automation_outbox_count integer not null,
  status text not null default 'reviewed' check (status in ('reviewed','retired')),
  created_at timestamptz not null default now(),
  constraint os_cleanup_manifest_scopes_hash_chk check (manifest_hash ~ '^[a-f0-9]{64}$')
);

insert into public.os_cleanup_manifest_scopes(manifest_hash,contract_version,contact_count,lead_count,event_count,integration_outbox_count,automation_outbox_count)
values('91dce9c0177ef89406ab70624b97fb0cf95bb4e1613c34baee56ade803c8d109','owner_cleanup_decision_v2',17,25,26,21,36);

create table public.os_cleanup_batches (
  id uuid primary key default gen_random_uuid(),
  manifest_hash text not null unique,
  contract_version text not null,
  customer_status text not null default 'previewed'
    check (customer_status in ('previewed','archived','restored')),
  outbox_status text not null default 'previewed'
    check (outbox_status in ('previewed','quarantined','restored')),
  contact_count integer not null,
  lead_count integer not null,
  event_count integer not null,
  integration_outbox_count integer not null,
  automation_outbox_count integer not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  customer_applied_by uuid references auth.users(id) on delete restrict,
  customer_applied_at timestamptz,
  customer_restored_by uuid references auth.users(id) on delete restrict,
  customer_restored_at timestamptz,
  outbox_applied_by uuid references auth.users(id) on delete restrict,
  outbox_applied_at timestamptz,
  outbox_restored_by uuid references auth.users(id) on delete restrict,
  outbox_restored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_cleanup_batches_manifest_hash_chk check (manifest_hash ~ '^[a-f0-9]{64}$'),
  constraint os_cleanup_batches_expected_counts_chk check (
    contact_count = 17 and lead_count = 25 and event_count = 26
    and integration_outbox_count = 21 and automation_outbox_count = 36
  )
);

create table public.os_cleanup_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.os_cleanup_batches(id) on delete restrict,
  action_group text not null check (action_group in ('customer_archive','outbox_quarantine')),
  record_type text not null check (record_type in ('contact','lead','event','integration_outbox','automation_outbox')),
  record_id uuid not null,
  status text not null default 'previewed' check (status in ('previewed','archived','quarantined','restored')),
  prior_state jsonb not null default '{}'::jsonb,
  applied_by uuid references auth.users(id) on delete restrict,
  applied_at timestamptz,
  restored_by uuid references auth.users(id) on delete restrict,
  restored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, record_type, record_id)
);

create index os_cleanup_batch_items_batch_group_status_idx
  on public.os_cleanup_batch_items(batch_id, action_group, status);
create index os_cleanup_batch_items_record_idx
  on public.os_cleanup_batch_items(record_type, record_id);
create index os_cleanup_batches_created_by_idx on public.os_cleanup_batches(created_by);
create index os_cleanup_batch_items_applied_by_idx on public.os_cleanup_batch_items(applied_by);
create index os_cleanup_batch_items_restored_by_idx on public.os_cleanup_batch_items(restored_by);
create index os_cleanup_batches_customer_applied_by_idx on public.os_cleanup_batches(customer_applied_by);
create index os_cleanup_batches_customer_restored_by_idx on public.os_cleanup_batches(customer_restored_by);
create index os_cleanup_batches_outbox_applied_by_idx on public.os_cleanup_batches(outbox_applied_by);
create index os_cleanup_batches_outbox_restored_by_idx on public.os_cleanup_batches(outbox_restored_by);

alter table public.os_cleanup_batches enable row level security;
alter table public.os_cleanup_batch_items enable row level security;
alter table public.os_cleanup_manifest_scopes enable row level security;
revoke all on table public.os_cleanup_manifest_scopes, public.os_cleanup_batches, public.os_cleanup_batch_items from public, anon, authenticated;
grant all on table public.os_cleanup_manifest_scopes, public.os_cleanup_batches, public.os_cleanup_batch_items to service_role;

create or replace function public.os_cleanup_require_owner()
returns uuid language plpgsql stable security invoker set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function public.os_preview_cleanup_manifest(p_manifest_base64 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.os_cleanup_require_owner();
  v_hash text;
  v_raw bytea;
  v_manifest_text text;
  v_manifest jsonb;
  v_customer jsonb;
  v_outbox jsonb;
  v_batch uuid;
  v_contact_ids uuid[];
  v_lead_ids uuid[];
  v_event_ids uuid[];
  v_integration_ids uuid[];
  v_automation_ids uuid[];
  v_unresolved_integration uuid[];
begin
  begin v_raw := decode(coalesce(p_manifest_base64,''),'base64');
  exception when others then raise exception 'Cleanup manifest upload is not valid base64' using errcode = '22023'; end;
  if octet_length(v_raw) > 524288 then
    raise exception 'Cleanup manifest exceeds the review limit' using errcode = '22023';
  end if;
  v_hash := encode(extensions.digest(v_raw,'sha256'),'hex');
  if not exists(select 1 from public.os_cleanup_manifest_scopes s where s.manifest_hash=v_hash and s.contract_version='owner_cleanup_decision_v2' and s.status='reviewed' and s.contact_count=17 and s.lead_count=25 and s.event_count=26 and s.integration_outbox_count=21 and s.automation_outbox_count=36) then
    raise exception 'Cleanup manifest hash does not match the Owner-reviewed artifact' using errcode = '22023';
  end if;
  begin v_manifest_text:=convert_from(v_raw,'UTF8'); v_manifest := v_manifest_text::jsonb;
  exception when others then raise exception 'Cleanup manifest is not valid JSON' using errcode = '22023'; end;
  if v_manifest->>'contractVersion' <> 'owner_cleanup_decision_v2'
     or coalesce((v_manifest->>'reviewOnly')::boolean,false) is not true
     or coalesce((v_manifest->>'executionAuthorized')::boolean,true) is not false
     or jsonb_array_length(coalesce(v_manifest->'decisionGroups','[]'::jsonb)) <> 3 then
    raise exception 'Cleanup manifest contract is not the reviewed version' using errcode = '22023';
  end if;
  select value into v_customer from jsonb_array_elements(v_manifest->'decisionGroups') where value->>'actionId' = 'CLEANUP-V2-ARCHIVE-ALL-TEST-CUSTOMER-RECORDS';
  select value into v_outbox from jsonb_array_elements(v_manifest->'decisionGroups') where value->>'actionId' = 'CLEANUP-V2-QUARANTINE-SYNTHETIC-OUTBOX';
  if v_customer is null or v_outbox is null then raise exception 'Required cleanup decision groups are missing' using errcode = '22023'; end if;
  select array_agg(value::uuid order by value::uuid) into v_contact_ids from jsonb_array_elements_text(v_customer->'exactRecords'->'contacts');
  select array_agg(value::uuid order by value::uuid) into v_lead_ids from jsonb_array_elements_text(v_customer->'exactRecords'->'leads');
  select array_agg(value::uuid order by value::uuid) into v_event_ids from jsonb_array_elements_text(v_customer->'exactRecords'->'events');
  select array_agg((value->>'id')::uuid order by (value->>'id')::uuid) into v_integration_ids
    from jsonb_array_elements(v_outbox->'integrationRecords') where (value->>'onlyOwnerConfirmedTestRecords')::boolean is true;
  select array_agg((value->>'id')::uuid order by (value->>'id')::uuid) into v_unresolved_integration
    from jsonb_array_elements(v_outbox->'integrationRecords') where (value->>'onlyOwnerConfirmedTestRecords')::boolean is not true;
  select array_agg((value->>'id')::uuid order by (value->>'id')::uuid) into v_automation_ids
    from jsonb_array_elements(v_outbox->'automationRecords') where (value->>'onlyOwnerConfirmedTestRecords')::boolean is true;
  if cardinality(v_contact_ids) <> 17 or cardinality(v_lead_ids) <> 25 or cardinality(v_event_ids) <> 26
     or cardinality(v_integration_ids) <> 21 or cardinality(v_automation_ids) <> 36
     or cardinality(v_unresolved_integration) <> 2 then
    raise exception 'Cleanup manifest item counts do not match the reviewed scope' using errcode = '22023';
  end if;
  if (select count(distinct record_id) from unnest(v_contact_ids) as u(record_id)) <> 17
     or (select count(distinct record_id) from unnest(v_lead_ids) as u(record_id)) <> 25
     or (select count(distinct record_id) from unnest(v_event_ids) as u(record_id)) <> 26
     or (select count(distinct record_id) from unnest(v_integration_ids) as u(record_id)) <> 21
     or (select count(distinct record_id) from unnest(v_automation_ids) as u(record_id)) <> 36 then
    raise exception 'Cleanup manifest contains duplicate identifiers' using errcode = '22023';
  end if;
  if exists (select 1 from public.os_contact_users cu where cu.contact_id = any(v_contact_ids))
     or exists (select 1 from public.os_events e join public.os_staff_assignments sa on sa.event_id=e.id where e.id=any(v_event_ids) and sa.status <> 'cancelled') then
    raise exception 'Cleanup manifest intersects a protected identity or active staff assignment' using errcode = '42501';
  end if;
  if (select count(*) from public.os_contacts where id=any(v_contact_ids)) <> 17
     or (select count(*) from public.os_leads where id=any(v_lead_ids)) <> 25
     or (select count(*) from public.os_events where id=any(v_event_ids)) <> 26
     or (select count(*) from public.os_integration_outbox where id=any(v_integration_ids) and status in ('pending','retry','failed')) <> 21
     or (select count(*) from public.os_automation_outbox where id=any(v_automation_ids) and status in ('pending','failed')) <> 36
     or (select count(*) from public.os_integration_outbox where id=any(v_unresolved_integration)) <> 2 then
    raise exception 'Cleanup targets have changed since Owner review' using errcode = '40001';
  end if;
  if exists (select 1 from unnest(v_unresolved_integration) as u(record_id) where record_id=any(v_integration_ids)) then
    raise exception 'Unresolved outbox work cannot be quarantined' using errcode = '42501';
  end if;
  insert into public.os_cleanup_batches(manifest_hash,contract_version,contact_count,lead_count,event_count,integration_outbox_count,automation_outbox_count,created_by)
  values(v_hash,'owner_cleanup_decision_v2',17,25,26,21,36,v_actor)
  on conflict (manifest_hash) do update set updated_at=public.os_cleanup_batches.updated_at
  returning id into v_batch;
  insert into public.os_cleanup_batch_items(batch_id,action_group,record_type,record_id)
    select v_batch,'customer_archive','contact',record_id from unnest(v_contact_ids) as u(record_id)
    union all select v_batch,'customer_archive','lead',record_id from unnest(v_lead_ids) as u(record_id)
    union all select v_batch,'customer_archive','event',record_id from unnest(v_event_ids) as u(record_id)
    union all select v_batch,'outbox_quarantine','integration_outbox',record_id from unnest(v_integration_ids) as u(record_id)
    union all select v_batch,'outbox_quarantine','automation_outbox',record_id from unnest(v_automation_ids) as u(record_id)
  on conflict (batch_id,record_type,record_id) do nothing;
  return jsonb_build_object('status','previewed','batchId',v_batch,'manifestHash',v_hash,
    'customerArchive',jsonb_build_object('contacts',17,'leads',25,'events',26),
    'outboxQuarantine',jsonb_build_object('integration',21,'automation',36,'unresolvedIntegrationExcluded',2));
end;
$$;

create or replace function public.os_execute_cleanup_customer_archive(p_batch_id uuid,p_manifest_hash text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.os_cleanup_require_owner(); v_batch public.os_cleanup_batches%rowtype;
begin
  select * into v_batch from public.os_cleanup_batches where id=p_batch_id and manifest_hash=lower(p_manifest_hash) for update;
  if not found then raise exception 'Reviewed cleanup batch/hash mismatch' using errcode='P0002'; end if;
  if p_confirmation <> 'ARCHIVE 17 CONTACTS, 25 LEADS, 26 EVENTS' then raise exception 'Exact customer archive confirmation required' using errcode='22023'; end if;
  if v_batch.customer_status='archived' then return jsonb_build_object('status','already_archived','batchId',p_batch_id); end if;
  if v_batch.customer_status not in ('previewed','restored') then raise exception 'Customer cleanup state is not executable' using errcode='22023'; end if;
  if exists(select 1 from public.os_cleanup_batch_items i join public.os_contact_users cu on cu.contact_id=i.record_id where i.batch_id=p_batch_id and i.record_type='contact') then raise exception 'Protected contact cannot be archived' using errcode='42501'; end if;
  if (select count(*) from public.os_cleanup_batch_items where batch_id=p_batch_id and record_type='contact')<>17
    or (select count(*) from public.os_cleanup_batch_items where batch_id=p_batch_id and record_type='lead')<>25
    or (select count(*) from public.os_cleanup_batch_items where batch_id=p_batch_id and record_type='event')<>26 then raise exception 'Exact customer item set mismatch' using errcode='22023'; end if;
  update public.os_cleanup_batch_items i set prior_state=jsonb_build_object('status',c.status),updated_at=now()
    from public.os_contacts c where i.batch_id=p_batch_id and i.record_type='contact' and i.record_id=c.id and i.status in ('previewed','restored') and i.prior_state='{}'::jsonb;
  update public.os_cleanup_batch_items i set prior_state=jsonb_build_object('status',l.status),updated_at=now()
    from public.os_leads l where i.batch_id=p_batch_id and i.record_type='lead' and i.record_id=l.id and i.status in ('previewed','restored') and i.prior_state='{}'::jsonb;
  update public.os_cleanup_batch_items i set prior_state=jsonb_build_object('status',e.status),updated_at=now()
    from public.os_events e where i.batch_id=p_batch_id and i.record_type='event' and i.record_id=e.id and i.status in ('previewed','restored') and i.prior_state='{}'::jsonb;
  update public.os_leads l set status='archived',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='lead' and i.record_id=l.id;
  update public.os_events e set status='archived',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='event' and i.record_id=e.id;
  update public.os_contacts c set status='archived',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='contact' and i.record_id=c.id;
  update public.os_cleanup_batch_items set status='archived',applied_by=v_actor,applied_at=now(),updated_at=now() where batch_id=p_batch_id and action_group='customer_archive';
  update public.os_cleanup_batches set customer_status='archived',customer_applied_by=v_actor,customer_applied_at=now(),updated_at=now() where id=p_batch_id;
  insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key)
    values(v_actor,'data_readiness.cleanup_customer_archived','system',jsonb_build_object('batchId',p_batch_id,'manifestHash',lower(p_manifest_hash),'contacts',17,'leads',25,'events',26),'cleanup:'||p_batch_id::text||':customer_archive') on conflict do nothing;
  return jsonb_build_object('status','archived','batchId',p_batch_id,'contacts',17,'leads',25,'events',26);
end;
$$;

create or replace function public.os_restore_cleanup_customer_archive(p_batch_id uuid,p_manifest_hash text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.os_cleanup_require_owner(); v_batch public.os_cleanup_batches%rowtype;
begin
  select * into v_batch from public.os_cleanup_batches where id=p_batch_id and manifest_hash=lower(p_manifest_hash) for update;
  if not found or v_batch.customer_status<>'archived' then raise exception 'Archived cleanup batch/hash mismatch' using errcode='P0002'; end if;
  if p_confirmation <> 'RESTORE CUSTOMER BATCH' then raise exception 'Exact customer restore confirmation required' using errcode='22023'; end if;
  if exists(select 1 from public.os_cleanup_batch_items i join public.os_contacts c on c.id=i.record_id where i.batch_id=p_batch_id and i.record_type='contact' and c.status<>'archived')
    or exists(select 1 from public.os_cleanup_batch_items i join public.os_leads l on l.id=i.record_id where i.batch_id=p_batch_id and i.record_type='lead' and l.status<>'archived')
    or exists(select 1 from public.os_cleanup_batch_items i join public.os_events e on e.id=i.record_id where i.batch_id=p_batch_id and i.record_type='event' and e.status<>'archived') then raise exception 'Archived records changed after cleanup; restore stopped' using errcode='40001'; end if;
  update public.os_contacts c set status=i.prior_state->>'status',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='contact' and i.record_id=c.id;
  update public.os_leads l set status=i.prior_state->>'status',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='lead' and i.record_id=l.id;
  update public.os_events e set status=i.prior_state->>'status',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='event' and i.record_id=e.id;
  update public.os_cleanup_batch_items set status='restored',restored_by=v_actor,restored_at=now(),updated_at=now() where batch_id=p_batch_id and action_group='customer_archive';
  update public.os_cleanup_batches set customer_status='restored',customer_restored_by=v_actor,customer_restored_at=now(),updated_at=now() where id=p_batch_id;
  insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key)
    values(v_actor,'data_readiness.cleanup_customer_restored','system',jsonb_build_object('batchId',p_batch_id,'manifestHash',lower(p_manifest_hash)),'cleanup:'||p_batch_id::text||':customer_restore') on conflict do nothing;
  return jsonb_build_object('status','restored','batchId',p_batch_id);
end;
$$;

create or replace function public.os_execute_cleanup_outbox_quarantine(p_batch_id uuid,p_manifest_hash text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.os_cleanup_require_owner(); v_batch public.os_cleanup_batches%rowtype;
begin
  select * into v_batch from public.os_cleanup_batches where id=p_batch_id and manifest_hash=lower(p_manifest_hash) for update;
  if not found then raise exception 'Reviewed cleanup batch/hash mismatch' using errcode='P0002'; end if;
  if p_confirmation <> 'QUARANTINE 57 OUTBOX ITEMS' then raise exception 'Exact outbox quarantine confirmation required' using errcode='22023'; end if;
  if v_batch.outbox_status='quarantined' then return jsonb_build_object('status','already_quarantined','batchId',p_batch_id); end if;
  if v_batch.outbox_status not in ('previewed','restored') then raise exception 'Outbox cleanup state is not executable' using errcode='22023'; end if;
  if (select count(*) from public.os_cleanup_batch_items where batch_id=p_batch_id and record_type='integration_outbox')<>21
    or (select count(*) from public.os_cleanup_batch_items where batch_id=p_batch_id and record_type='automation_outbox')<>36 then raise exception 'Exact outbox item set mismatch' using errcode='22023'; end if;
  if (select count(*) from public.os_cleanup_batch_items i join public.os_integration_outbox o on o.id=i.record_id where i.batch_id=p_batch_id and i.record_type='integration_outbox' and o.status in ('pending','retry','failed'))<>21
    or (select count(*) from public.os_cleanup_batch_items i join public.os_automation_outbox o on o.id=i.record_id where i.batch_id=p_batch_id and i.record_type='automation_outbox' and o.status in ('pending','failed'))<>36 then raise exception 'Outbox targets changed after review' using errcode='40001'; end if;
  update public.os_cleanup_batch_items i set prior_state=jsonb_build_object('status',o.status),updated_at=now() from public.os_integration_outbox o where i.batch_id=p_batch_id and i.record_type='integration_outbox' and i.record_id=o.id and i.prior_state='{}'::jsonb;
  update public.os_cleanup_batch_items i set prior_state=jsonb_build_object('status',o.status),updated_at=now() from public.os_automation_outbox o where i.batch_id=p_batch_id and i.record_type='automation_outbox' and i.record_id=o.id and i.prior_state='{}'::jsonb;
  update public.os_integration_outbox o set status='quarantined',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='integration_outbox' and i.record_id=o.id;
  update public.os_automation_outbox o set status='quarantined',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='automation_outbox' and i.record_id=o.id;
  update public.os_cleanup_batch_items set status='quarantined',applied_by=v_actor,applied_at=now(),updated_at=now() where batch_id=p_batch_id and action_group='outbox_quarantine';
  update public.os_cleanup_batches set outbox_status='quarantined',outbox_applied_by=v_actor,outbox_applied_at=now(),updated_at=now() where id=p_batch_id;
  insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key)
    values(v_actor,'data_readiness.cleanup_outbox_quarantined','system',jsonb_build_object('batchId',p_batch_id,'manifestHash',lower(p_manifest_hash),'integration',21,'automation',36),'cleanup:'||p_batch_id::text||':outbox_quarantine') on conflict do nothing;
  return jsonb_build_object('status','quarantined','batchId',p_batch_id,'integration',21,'automation',36);
end;
$$;

create or replace function public.os_restore_cleanup_outbox_quarantine(p_batch_id uuid,p_manifest_hash text,p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.os_cleanup_require_owner(); v_batch public.os_cleanup_batches%rowtype;
begin
  select * into v_batch from public.os_cleanup_batches where id=p_batch_id and manifest_hash=lower(p_manifest_hash) for update;
  if not found or v_batch.outbox_status<>'quarantined' then raise exception 'Quarantined cleanup batch/hash mismatch' using errcode='P0002'; end if;
  if p_confirmation <> 'RESTORE OUTBOX BATCH' then raise exception 'Exact outbox restore confirmation required' using errcode='22023'; end if;
  if exists(select 1 from public.os_cleanup_batch_items i join public.os_integration_outbox o on o.id=i.record_id where i.batch_id=p_batch_id and i.record_type='integration_outbox' and o.status<>'quarantined')
    or exists(select 1 from public.os_cleanup_batch_items i join public.os_automation_outbox o on o.id=i.record_id where i.batch_id=p_batch_id and i.record_type='automation_outbox' and o.status<>'quarantined') then raise exception 'Quarantined records changed after cleanup; restore stopped' using errcode='40001'; end if;
  update public.os_integration_outbox o set status=i.prior_state->>'status',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='integration_outbox' and i.record_id=o.id;
  update public.os_automation_outbox o set status=i.prior_state->>'status',updated_at=now() from public.os_cleanup_batch_items i where i.batch_id=p_batch_id and i.record_type='automation_outbox' and i.record_id=o.id;
  update public.os_cleanup_batch_items set status='restored',restored_by=v_actor,restored_at=now(),updated_at=now() where batch_id=p_batch_id and action_group='outbox_quarantine';
  update public.os_cleanup_batches set outbox_status='restored',outbox_restored_by=v_actor,outbox_restored_at=now(),updated_at=now() where id=p_batch_id;
  insert into public.os_activity_events(actor_user_id,event_type,visibility,payload,idempotency_key)
    values(v_actor,'data_readiness.cleanup_outbox_restored','system',jsonb_build_object('batchId',p_batch_id,'manifestHash',lower(p_manifest_hash)),'cleanup:'||p_batch_id::text||':outbox_restore') on conflict do nothing;
  return jsonb_build_object('status','restored','batchId',p_batch_id);
end;
$$;

-- Normal operational surfaces exclude archived customer chains. The Owner-only
-- Records & Intake snapshot remains the explicit archive/history surface.
create or replace view public.os_event_dashboard_v with (security_invoker = true) as
select
  e.id event_id,e.title,e.event_type,e.status event_status,e.starts_at,e.ends_at,e.timezone,e.venue_name,
  concat_ws(', ',nullif(e.venue_address_1,''),nullif(e.venue_city,''),nullif(e.venue_state,''),nullif(e.venue_postal_code,'')) venue_summary,
  e.guest_count,e.public_slug,e.source,e.updated_at event_updated_at,c.id primary_contact_id,
  coalesce(c.display_name,nullif(concat_ws(' ',c.first_name,c.last_name),''),c.organization_name) primary_contact_name,
  c.organization_name,c.primary_email,c.primary_phone,l.id lead_id,l.status lead_status,l.next_follow_up_at,
  q.id latest_quote_id,q.version_number latest_quote_version,q.status latest_quote_status,q.total_amount quote_total,q.deposit_amount quote_deposit,
  b.id booking_id,b.status booking_status,b.contract_status,b.payment_status,b.total_amount booked_total,b.deposit_amount booked_deposit,b.balance_due,b.balance_due_at,
  p.assignment_id,p.template_slug planning_template,p.template_name planning_template_name,p.planning_status,p.progress_percent,p.first_opened_at,p.last_opened_at,p.last_saved_at,p.submitted_at,
  coalesce(s.services,'[]'::jsonb) booked_services,a.last_activity_type,a.last_activity_at
from public.os_events e
left join public.os_contacts c on c.id=e.primary_contact_id
left join lateral (select lead.* from public.os_leads lead where lead.event_id=e.id and lead.status<>'archived' order by lead.updated_at desc limit 1) l on true
left join lateral (select quote.* from public.os_quote_versions quote where quote.event_id=e.id order by quote.version_number desc limit 1) q on true
left join public.os_bookings b on b.event_id=e.id
left join lateral (select pa.id assignment_id,pt.slug template_slug,pt.name template_name,pa.status planning_status,pa.progress_percent,pa.first_opened_at,pa.last_opened_at,pa.last_saved_at,pa.submitted_at from public.os_planning_assignments pa join public.os_planning_templates pt on pt.id=pa.template_id where pa.event_id=e.id order by pa.updated_at desc limit 1) p on true
left join lateral (select jsonb_agg(jsonb_build_object('id',bs.id,'code',bs.service_code,'name',bs.service_name,'status',bs.status,'starts_at',bs.starts_at,'ends_at',bs.ends_at,'location',bs.location_label,'configuration',bs.configuration) order by bs.created_at) services from public.os_booking_services bs where b.id is not null and bs.booking_id=b.id and bs.status<>'cancelled') s on true
left join lateral (select ae.event_type last_activity_type,ae.occurred_at last_activity_at from public.os_activity_events ae where ae.event_id=e.id order by ae.occurred_at desc limit 1) a on true
where e.status<>'archived' and coalesce(c.status,'active')<>'archived';

-- Client-scoped helpers fail closed after a parent is archived. Recognized HQ
-- staff retain their existing access; normal HQ screens filter archived rows,
-- while the Owner-only cleanup snapshot is the explicit history surface.
create or replace function public.os_has_event_access(target_event_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.os_is_staff() or exists (
    select 1 from public.os_event_members em
    join public.os_events e on e.id=em.event_id
    where em.event_id=target_event_id and em.user_id=auth.uid() and em.is_active and e.status<>'archived'
  );
$$;

create or replace function public.os_has_contact_access(target_contact_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.os_is_staff() or exists (
    select 1 from public.os_contact_users cu
    join public.os_contacts c on c.id=cu.contact_id
    where cu.contact_id=target_contact_id and cu.user_id=auth.uid() and c.status<>'archived'
  );
$$;

create or replace function public.os_has_assignment_access(target_assignment_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.os_is_staff() or exists (
    select 1 from public.os_planning_assignments pa
    join public.os_event_members em on em.event_id=pa.event_id
    join public.os_events e on e.id=pa.event_id
    where pa.id=target_assignment_id and em.user_id=auth.uid() and em.is_active and e.status<>'archived'
  );
$$;

create or replace function public.os_cleanup_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.os_cleanup_require_owner();
  return jsonb_build_object(
    'batches',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (select id,manifest_hash,contract_version,customer_status,outbox_status,contact_count,lead_count,event_count,integration_outbox_count,automation_outbox_count,created_at,customer_applied_at,customer_restored_at,outbox_applied_at,outbox_restored_at from public.os_cleanup_batches order by created_at desc limit 20)b),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from (select id,batch_id,action_group,record_type,status,created_at,applied_at,restored_at from public.os_cleanup_batch_items order by created_at desc limit 250)i),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.os_cleanup_require_owner() from public, anon, authenticated;
revoke all on function public.os_preview_cleanup_manifest(text) from public, anon, authenticated;
revoke all on function public.os_execute_cleanup_customer_archive(uuid,text,text) from public, anon, authenticated;
revoke all on function public.os_restore_cleanup_customer_archive(uuid,text,text) from public, anon, authenticated;
revoke all on function public.os_execute_cleanup_outbox_quarantine(uuid,text,text) from public, anon, authenticated;
revoke all on function public.os_restore_cleanup_outbox_quarantine(uuid,text,text) from public, anon, authenticated;
revoke all on function public.os_cleanup_snapshot() from public, anon, authenticated;
grant execute on function public.os_preview_cleanup_manifest(text) to authenticated, service_role;
grant execute on function public.os_execute_cleanup_customer_archive(uuid,text,text) to authenticated, service_role;
grant execute on function public.os_restore_cleanup_customer_archive(uuid,text,text) to authenticated, service_role;
grant execute on function public.os_execute_cleanup_outbox_quarantine(uuid,text,text) to authenticated, service_role;
grant execute on function public.os_restore_cleanup_outbox_quarantine(uuid,text,text) to authenticated, service_role;
grant execute on function public.os_cleanup_snapshot() to authenticated, service_role;
