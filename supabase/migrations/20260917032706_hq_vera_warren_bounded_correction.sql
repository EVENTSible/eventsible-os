-- Bounded correction for one reviewed Vera/Warren consolidation error.
-- This migration creates no business or review records. The correction remains
-- an explicit Owner-only action with a read-only preview and reversible audit.

create table public.os_owner_maintenance_corrections (
  id uuid primary key default gen_random_uuid(),
  correction_key text not null unique,
  status text not null default 'ready',
  target_event_id uuid not null references public.os_events(id) on delete restrict,
  import_batch_id uuid not null references public.os_import_batches(id) on delete restrict,
  review_candidate_id uuid references public.os_event_import_candidates(id) on delete restrict,
  before_fingerprint text not null,
  after_fingerprint text,
  before_image jsonb not null,
  after_image jsonb,
  applied_by uuid references auth.users(id) on delete restrict,
  applied_at timestamptz,
  compensated_by uuid references auth.users(id) on delete restrict,
  compensated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_owner_maintenance_corrections_key_chk check (
    correction_key ~ '^[a-z0-9][a-z0-9._:-]{0,119}$'
  ),
  constraint os_owner_maintenance_corrections_status_chk check (
    status in ('ready','applied','compensated')
  ),
  constraint os_owner_maintenance_corrections_before_hash_chk check (
    before_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint os_owner_maintenance_corrections_after_hash_chk check (
    after_fingerprint is null or after_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint os_owner_maintenance_corrections_state_chk check (
    (status='ready' and applied_by is null and applied_at is null and compensated_by is null and compensated_at is null)
    or (status='applied' and applied_by is not null and applied_at is not null and compensated_by is null and compensated_at is null)
    or (status='compensated' and applied_by is not null and applied_at is not null and compensated_by is not null and compensated_at is not null)
  )
);

create index os_owner_maintenance_corrections_event_idx
  on public.os_owner_maintenance_corrections(target_event_id, created_at desc);
create index os_owner_maintenance_corrections_batch_idx
  on public.os_owner_maintenance_corrections(import_batch_id, created_at desc);
create index os_owner_maintenance_corrections_candidate_idx
  on public.os_owner_maintenance_corrections(review_candidate_id)
  where review_candidate_id is not null;
create index os_owner_maintenance_corrections_applied_by_idx
  on public.os_owner_maintenance_corrections(applied_by)
  where applied_by is not null;
create index os_owner_maintenance_corrections_compensated_by_idx
  on public.os_owner_maintenance_corrections(compensated_by)
  where compensated_by is not null;

create trigger os_owner_maintenance_corrections_updated_at
before update on public.os_owner_maintenance_corrections
for each row execute function public.os_set_updated_at();

alter table public.os_owner_maintenance_corrections enable row level security;
revoke all on table public.os_owner_maintenance_corrections from public, anon, authenticated;
grant all on table public.os_owner_maintenance_corrections to service_role;

create or replace function private.os_vera_warren_correction_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event',(select to_jsonb(e) from public.os_events e where e.id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid),
    'contact',(select to_jsonb(c) from public.os_contacts c where c.id='95b7bf33-f26d-485e-be03-b4fe67ddf0ef'::uuid),
    'lead',(select to_jsonb(l) from public.os_leads l where l.id='173b88a0-c451-4dc3-a1d9-79b6aaf91ae8'::uuid),
    'booking',(select to_jsonb(b) from public.os_bookings b where b.id='f179beac-b1e3-4cf6-a5d8-6e6edab1db80'::uuid),
    'services',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.os_booking_services s where s.id in ('b5bf5927-f0d1-459a-a17e-93f886d7c2f7'::uuid,'1a3ea9b8-ef94-44b6-8463-981b9abd8371'::uuid)),'[]'::jsonb),
    'paymentFact',(select to_jsonb(f) from public.os_booking_payment_facts f where f.id='62421a88-2c6f-4e04-8ec9-5f15047b36b9'::uuid),
    'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.os_staff_assignments a where a.id in ('5dfdb5ee-3436-4b12-9c58-edf47b98924e'::uuid,'7244fb1e-4896-44b4-858f-9dfeee6b4b25'::uuid)),'[]'::jsonb),
    'incorrectNote',(select to_jsonb(n) from public.os_event_notes n where n.id='d4549943-7e9b-40eb-9ffb-888d75ed62a2'::uuid),
    'provenance',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.os_import_source_provenance p where p.id in ('d8cd3f6b-9520-4ef2-a870-6d155e7a9788'::uuid,'ca45d79e-bb12-4113-911c-360c9a7b411d'::uuid)),'[]'::jsonb),
    'batch',(select to_jsonb(b) from public.os_import_batches b where b.id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid),
    'batchItems',coalesce((select jsonb_agg(to_jsonb(i) order by i.item_key) from public.os_import_batch_items i where i.batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid),'[]'::jsonb),
    'warrenCandidate',(select to_jsonb(c) from public.os_event_import_candidates c where c.source='owner_correction' and c.external_reference='warren-70th-birthday:2026-09-26')
  );
$$;
revoke all on function private.os_vera_warren_correction_snapshot() from public, anon, authenticated;

create or replace function private.os_vera_warren_correction_fingerprint()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(private.os_vera_warren_correction_snapshot()::text,'UTF8'),'sha256'),'hex');
$$;
revoke all on function private.os_vera_warren_correction_fingerprint() from public, anon, authenticated;

create or replace function private.os_assert_vera_warren_before_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
begin
  perform 1 from public.os_events where id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid for update;
  if not found then raise exception 'Reviewed Vera event is unavailable' using errcode='P0002'; end if;
  perform 1 from public.os_contacts where id='95b7bf33-f26d-485e-be03-b4fe67ddf0ef'::uuid for update;
  perform 1 from public.os_leads where id='173b88a0-c451-4dc3-a1d9-79b6aaf91ae8'::uuid for update;
  perform 1 from public.os_bookings where id='f179beac-b1e3-4cf6-a5d8-6e6edab1db80'::uuid for update;
  perform 1 from public.os_booking_services where id in ('b5bf5927-f0d1-459a-a17e-93f886d7c2f7'::uuid,'1a3ea9b8-ef94-44b6-8463-981b9abd8371'::uuid) order by id for update;
  perform 1 from public.os_booking_payment_facts where id='62421a88-2c6f-4e04-8ec9-5f15047b36b9'::uuid for update;
  perform 1 from public.os_staff_assignments where id in ('5dfdb5ee-3436-4b12-9c58-edf47b98924e'::uuid,'7244fb1e-4896-44b4-858f-9dfeee6b4b25'::uuid) order by id for update;
  perform 1 from public.os_event_notes where id='d4549943-7e9b-40eb-9ffb-888d75ed62a2'::uuid for update;
  perform 1 from public.os_import_source_provenance where id in ('d8cd3f6b-9520-4ef2-a870-6d155e7a9788'::uuid,'ca45d79e-bb12-4113-911c-360c9a7b411d'::uuid) order by id for update;
  perform 1 from public.os_import_batches where id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid for update;
  perform 1 from public.os_import_batch_items where batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid order by id for update;

  if not exists (
    select 1 from public.os_events e
    where e.id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid
      and e.primary_contact_id='95b7bf33-f26d-485e-be03-b4fe67ddf0ef'::uuid
      and e.title='Warren 70th Birthday Karaoke'
      and e.event_type='birthday_party'
      and e.status='completed'
      and e.starts_at='2026-08-22 23:00:00+00'::timestamptz
      and e.ends_at='2026-08-23 03:30:00+00'::timestamptz
      and e.historical_date is null
      and e.timezone='America/Chicago'
      and lower(e.venue_city)='south holland'
      and lower(e.venue_state) in ('illinois','il')
  ) then raise exception 'Reviewed Vera event preconditions changed' using errcode='40001'; end if;

  if not exists (select 1 from public.os_contacts c where c.id='95b7bf33-f26d-485e-be03-b4fe67ddf0ef'::uuid and c.status='active')
    or not exists (select 1 from public.os_leads l where l.id='173b88a0-c451-4dc3-a1d9-79b6aaf91ae8'::uuid and l.contact_id='95b7bf33-f26d-485e-be03-b4fe67ddf0ef'::uuid and l.event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid and l.status='won' and l.estimated_value=675)
    or not exists (select 1 from public.os_bookings b where b.id='f179beac-b1e3-4cf6-a5d8-6e6edab1db80'::uuid and b.event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid and b.status='completed' and b.payment_status='paid' and b.total_amount=675 and b.balance_due=0)
  then raise exception 'Reviewed Vera contact, inquiry, or booking preconditions changed' using errcode='40001'; end if;

  if (select count(*) from public.os_booking_services s where s.booking_id='f179beac-b1e3-4cf6-a5d8-6e6edab1db80'::uuid and s.id in ('b5bf5927-f0d1-459a-a17e-93f886d7c2f7'::uuid,'1a3ea9b8-ef94-44b6-8463-981b9abd8371'::uuid))<>2
    or (select count(*) from public.os_booking_services s where s.booking_id='f179beac-b1e3-4cf6-a5d8-6e6edab1db80'::uuid)<>2
    or not exists (select 1 from public.os_booking_payment_facts f where f.id='62421a88-2c6f-4e04-8ec9-5f15047b36b9'::uuid and f.booking_id='f179beac-b1e3-4cf6-a5d8-6e6edab1db80'::uuid and f.contracted_or_quoted_amount=675 and f.gross_client_amount=675 and f.balance_due_amount=0 and f.payment_status='paid' and f.status='active')
  then raise exception 'Reviewed Vera service or payment preconditions changed' using errcode='40001'; end if;

  if (select count(*) from public.os_staff_assignments a where a.event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid and a.id in ('5dfdb5ee-3436-4b12-9c58-edf47b98924e'::uuid,'7244fb1e-4896-44b4-858f-9dfeee6b4b25'::uuid))<>2
    or (select count(*) from public.os_staff_assignments a where a.event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid)<>2
    or not exists (select 1 from public.os_event_notes n where n.id='d4549943-7e9b-40eb-9ffb-888d75ed62a2'::uuid and n.event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid and n.status='active')
  then raise exception 'Reviewed Vera assignment or note preconditions changed' using errcode='40001'; end if;

  if not exists (select 1 from public.os_import_source_provenance p where p.id='d8cd3f6b-9520-4ef2-a870-6d155e7a9788'::uuid and p.event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid and upper(p.source_hash)='343FDBB586B9210EAD219793CEA6253D4A04F28AF2C20A558A7120CA3DC3D6AB')
    or not exists (select 1 from public.os_import_source_provenance p where p.id='ca45d79e-bb12-4113-911c-360c9a7b411d'::uuid and p.event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid and p.source_ref='Warren service agreement' and upper(p.source_hash)='CD6F281C5E6E0353981E07DE809306D24861501DE29FFA621AAC5343487219C1')
  then raise exception 'Reviewed Vera provenance preconditions changed' using errcode='40001'; end if;

  if not exists (select 1 from public.os_import_batches b where b.id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid and b.contract_version='intake_manifest_v2' and b.status='completed' and b.row_count=243 and b.created_count=243)
    or (select count(*) from public.os_import_batch_items i where i.batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid)<>243
    or (select count(*) from public.os_import_batch_items i where i.batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid and i.status='applied')<>243
  then raise exception 'Completed import audit preconditions changed' using errcode='40001'; end if;

  if exists (
    select 1
    from (values
      ('contact.c0068','contact','95b7bf33-f26d-485e-be03-b4fe67ddf0ef'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('event.invoice-0068.20260822','event','4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('inquiry.invoice-0068.20260822','inquiry','173b88a0-c451-4dc3-a1d9-79b6aaf91ae8'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('booking.invoice-0068.20260822','booking','f179beac-b1e3-4cf6-a5d8-6e6edab1db80'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('service.invoice-0068.20260822.karaoke','booking_service','b5bf5927-f0d1-459a-a17e-93f886d7c2f7'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('service.invoice-0068.20260822.rentals','booking_service','1a3ea9b8-ef94-44b6-8463-981b9abd8371'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('payment.invoice-0068.20260822','payment_fact','62421a88-2c6f-4e04-8ec9-5f15047b36b9'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('assignment.invoice-0068.20260822.trav','staff_assignment','5dfdb5ee-3436-4b12-9c58-edf47b98924e'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('assignment.invoice-0068.20260822.missy','staff_assignment','7244fb1e-4896-44b4-858f-9dfeee6b4b25'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('note.invoice-0068.20260822.1','operational_note','d4549943-7e9b-40eb-9ffb-888d75ed62a2'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('provenance.invoice-0068.20260822.1','source_provenance','d8cd3f6b-9520-4ef2-a870-6d155e7a9788'::uuid,'343fdbb586b9210ead219793cea6253d4a04f28af2c20a558a7120ca3dc3d6ab'),
      ('provenance.invoice-0068.20260822.2','source_provenance','ca45d79e-bb12-4113-911c-360c9a7b411d'::uuid,'cd6f281c5e6e0353981e07de809306d24861501de29ffa621aac5343487219c1')
    ) expected(item_key,candidate_type,primary_id,source_hash)
    where not exists (
      select 1 from public.os_import_batch_items i
      where i.batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid
        and i.item_key=expected.item_key
        and i.candidate_type=expected.candidate_type
        and i.status='applied'
        and (i.canonical_record_ids->>'primaryId')::uuid=expected.primary_id
        and i.source_hash=expected.source_hash
    )
  ) then raise exception 'Reviewed import item-to-record mapping changed' using errcode='40001'; end if;

  if exists (select 1 from public.os_event_import_candidates c where c.source='owner_correction' and c.external_reference='warren-70th-birthday:2026-09-26')
  then raise exception 'Warren review candidate already exists outside this correction' using errcode='23505'; end if;

  v_snapshot:=private.os_vera_warren_correction_snapshot();
  return v_snapshot;
end;
$$;
revoke all on function private.os_assert_vera_warren_before_state() from public, anon, authenticated;

create or replace function public.os_preview_vera_warren_correction()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_existing public.os_owner_maintenance_corrections%rowtype;
  v_before jsonb;
  v_fingerprint text;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then
    raise exception 'Owner authorization required' using errcode='42501';
  end if;
  select * into v_existing from public.os_owner_maintenance_corrections where correction_key='vera-warren-separation-v1';
  if found then
    return jsonb_build_object('status',v_existing.status,'correctionId',v_existing.id,'currentFingerprint',private.os_vera_warren_correction_fingerprint(),'reviewCandidateId',v_existing.review_candidate_id);
  end if;
  v_before:=private.os_assert_vera_warren_before_state();
  v_fingerprint:=encode(extensions.digest(convert_to(v_before::text,'UTF8'),'sha256'),'hex');
  return jsonb_build_object(
    'status','ready',
    'currentFingerprint',v_fingerprint,
    'requiredConfirmation','CORRECT VERA / REVIEW WARREN',
    'vera',jsonb_build_object('eventId','4c277aa1-fbcd-4422-ba6b-7ce294a32ea5','currentTitle','Warren 70th Birthday Karaoke','correctedTitle','70th Birthday Celebration','date','2026-08-22','timezone','America/Chicago','time','6:00 PM–10:30 PM Central'),
    'warren',jsonb_build_object('candidateTitle','Warren’s 70th Birthday','eventDate','2026-09-26','venueLabel','Wingate by Wyndham','reviewState','unresolved calendar evidence','canonicalRecordsCreated',0),
    'protected',jsonb_build_object('importBatchId','4beb47eb-3087-4e51-9fda-ddb2eaa84893','importItemCount',243,'otherImportedGigsChanged',0,'notificationsCreated',0,'outboxRowsCreated',0)
  );
end;
$$;

create or replace function public.os_apply_vera_warren_correction(
  p_expected_fingerprint text,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_existing public.os_owner_maintenance_corrections%rowtype;
  v_before jsonb;
  v_before_fingerprint text;
  v_after jsonb;
  v_after_fingerprint text;
  v_correction_id uuid;
  v_candidate_id uuid;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_confirmation<>'CORRECT VERA / REVIEW WARREN' then raise exception 'Exact correction confirmation required' using errcode='22023'; end if;
  if lower(coalesce(p_expected_fingerprint,'')) !~ '^[a-f0-9]{64}$' then raise exception 'Valid preview fingerprint required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('eventsible.owner_correction.vera_warren.v1',0));
  perform pg_advisory_xact_lock(hashtextextended('eventsible.complete_intake.native_compatibility',0));
  select * into v_existing from public.os_owner_maintenance_corrections where correction_key='vera-warren-separation-v1' for update;
  if found then
    if v_existing.status='applied' and v_existing.after_fingerprint=private.os_vera_warren_correction_fingerprint() then
      return jsonb_build_object('status','replayed','correctionId',v_existing.id,'reviewCandidateId',v_existing.review_candidate_id,'afterFingerprint',v_existing.after_fingerprint);
    end if;
    raise exception 'Correction audit state does not permit application' using errcode='40001';
  end if;

  v_before:=private.os_assert_vera_warren_before_state();
  v_before_fingerprint:=encode(extensions.digest(convert_to(v_before::text,'UTF8'),'sha256'),'hex');
  if v_before_fingerprint<>lower(p_expected_fingerprint) then raise exception 'Correction preview is stale' using errcode='40001'; end if;

  insert into public.os_owner_maintenance_corrections(correction_key,status,target_event_id,import_batch_id,before_fingerprint,before_image)
  values('vera-warren-separation-v1','ready','4c277aa1-fbcd-4422-ba6b-7ce294a32ea5','4beb47eb-3087-4e51-9fda-ddb2eaa84893',v_before_fingerprint,v_before)
  returning id into v_correction_id;

  update public.os_events set title='70th Birthday Celebration',updated_at=now()
  where id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid;
  if not found then raise exception 'Reviewed Vera event changed during correction' using errcode='40001'; end if;

  update public.os_import_source_provenance set source_ref='Vera service agreement'
  where id='ca45d79e-bb12-4113-911c-360c9a7b411d'::uuid
    and source_ref='Warren service agreement'
    and upper(source_hash)='CD6F281C5E6E0353981E07DE809306D24861501DE29FFA621AAC5343487219C1';
  if not found then raise exception 'Reviewed Vera provenance changed during correction' using errcode='40001'; end if;

  update public.os_event_notes set status='archived',updated_at=now()
  where id='d4549943-7e9b-40eb-9ffb-888d75ed62a2'::uuid and status='active';
  if not found then raise exception 'False consolidation note changed during correction' using errcode='40001'; end if;

  insert into public.os_event_import_candidates(
    contract_version,source,external_reference,proposed_data,review_status,created_by_user_id
  ) values (
    'existing_gig_candidate_v1','owner_correction','warren-70th-birthday:2026-09-26',
    jsonb_build_object(
      'title','Warren’s 70th Birthday',
      'event_date','2026-09-26',
      'venue_name','Wingate by Wyndham',
      'review_state','unresolved_calendar_evidence',
      'source_description','Owner-confirmed correction following erroneous invoice-0068 consolidation',
      'screenshot_provenance_state','original_bytes_and_sha256_pending_recovery',
      'canonicalization_blocked',true,
      'contact',null,
      'starts_at',null,
      'ends_at',null,
      'timezone',null,
      'services','[]'::jsonb,
      'staff','[]'::jsonb,
      'financial_facts',null
    ),
    'pending',v_actor
  ) returning id into v_candidate_id;

  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
  values(
    '4c277aa1-fbcd-4422-ba6b-7ce294a32ea5','95b7bf33-f26d-485e-be03-b4fe67ddf0ef',v_actor,
    'data_readiness.vera_warren_correction_applied','staff',
    jsonb_build_object('correctionId',v_correction_id,'beforeFingerprint',v_before_fingerprint,'supersededNoteId','d4549943-7e9b-40eb-9ffb-888d75ed62a2','reviewCandidateId',v_candidate_id,'reason','Invoice 0068 and its service agreement belong to Vera; Warren is a separate unresolved calendar record.'),
    'owner_correction:vera-warren-separation-v1:apply'
  );

  v_after:=private.os_vera_warren_correction_snapshot();
  v_after_fingerprint:=encode(extensions.digest(convert_to(v_after::text,'UTF8'),'sha256'),'hex');
  update public.os_owner_maintenance_corrections
  set status='applied',review_candidate_id=v_candidate_id,after_fingerprint=v_after_fingerprint,after_image=v_after,applied_by=v_actor,applied_at=now(),updated_at=now()
  where id=v_correction_id;

  return jsonb_build_object('status','applied','correctionId',v_correction_id,'reviewCandidateId',v_candidate_id,'beforeFingerprint',v_before_fingerprint,'afterFingerprint',v_after_fingerprint);
end;
$$;

create or replace function public.os_compensate_vera_warren_correction(
  p_expected_after_fingerprint text,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_correction public.os_owner_maintenance_corrections%rowtype;
  v_current_fingerprint text;
  v_prior_source_ref text;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_confirmation<>'COMPENSATE VERA WARREN' then raise exception 'Exact compensation confirmation required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eventsible.owner_correction.vera_warren.v1',0));
  perform pg_advisory_xact_lock(hashtextextended('eventsible.complete_intake.native_compatibility',0));
  select * into v_correction from public.os_owner_maintenance_corrections where correction_key='vera-warren-separation-v1' for update;
  if not found then raise exception 'Correction audit was not found' using errcode='P0002'; end if;
  if v_correction.status='compensated' then return jsonb_build_object('status','replayed','correctionId',v_correction.id); end if;
  if v_correction.status<>'applied' then raise exception 'Correction is not eligible for compensation' using errcode='40001'; end if;
  v_current_fingerprint:=private.os_vera_warren_correction_fingerprint();
  if v_current_fingerprint<>v_correction.after_fingerprint or v_current_fingerprint<>lower(coalesce(p_expected_after_fingerprint,'')) then raise exception 'Correction state changed after application' using errcode='40001'; end if;
  if not exists (select 1 from public.os_events where id=v_correction.target_event_id and title='70th Birthday Celebration')
    or not exists (select 1 from public.os_import_source_provenance where id='ca45d79e-bb12-4113-911c-360c9a7b411d'::uuid and source_ref='Vera service agreement')
    or not exists (select 1 from public.os_event_notes where id='d4549943-7e9b-40eb-9ffb-888d75ed62a2'::uuid and status='archived')
    or not exists (select 1 from public.os_event_import_candidates where id=v_correction.review_candidate_id and review_status='pending')
  then raise exception 'Corrected records changed after application' using errcode='40001'; end if;

  update public.os_events
  set title=v_correction.before_image->'event'->>'title',
      updated_at=(v_correction.before_image->'event'->>'updated_at')::timestamptz
  where id=v_correction.target_event_id;

  select p->>'source_ref' into v_prior_source_ref
  from jsonb_array_elements(v_correction.before_image->'provenance') p
  where p->>'id'='ca45d79e-bb12-4113-911c-360c9a7b411d';
  update public.os_import_source_provenance set source_ref=v_prior_source_ref
  where id='ca45d79e-bb12-4113-911c-360c9a7b411d'::uuid;

  update public.os_event_notes
  set status=v_correction.before_image->'incorrectNote'->>'status',
      updated_at=(v_correction.before_image->'incorrectNote'->>'updated_at')::timestamptz
  where id='d4549943-7e9b-40eb-9ffb-888d75ed62a2'::uuid;

  update public.os_event_import_candidates
  set review_status='ignored',reviewed_by_user_id=v_actor,reviewed_at=now(),matched_event_id=null
  where id=v_correction.review_candidate_id and review_status='pending';
  if not found then raise exception 'Warren review candidate changed during compensation' using errcode='40001'; end if;

  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
  values(
    v_correction.target_event_id,'95b7bf33-f26d-485e-be03-b4fe67ddf0ef',v_actor,
    'data_readiness.vera_warren_correction_compensated','staff',
    jsonb_build_object('correctionId',v_correction.id,'restoredBeforeFingerprint',v_correction.before_fingerprint,'reviewCandidateId',v_correction.review_candidate_id,'candidateDisposition','ignored'),
    'owner_correction:vera-warren-separation-v1:compensate'
  );

  update public.os_owner_maintenance_corrections
  set status='compensated',compensated_by=v_actor,compensated_at=now(),updated_at=now()
  where id=v_correction.id;
  return jsonb_build_object('status','compensated','correctionId',v_correction.id,'reviewCandidateId',v_correction.review_candidate_id,'restoredFingerprint',v_correction.before_fingerprint);
end;
$$;

revoke all on function public.os_preview_vera_warren_correction() from public, anon, authenticated;
revoke all on function public.os_apply_vera_warren_correction(text,text) from public, anon, authenticated;
revoke all on function public.os_compensate_vera_warren_correction(text,text) from public, anon, authenticated;
grant execute on function public.os_preview_vera_warren_correction() to authenticated;
grant execute on function public.os_apply_vera_warren_correction(text,text) to authenticated;
grant execute on function public.os_compensate_vera_warren_correction(text,text) to authenticated;

-- Forward-only rollback: leave audit and candidate history intact. If the
-- correction is ever applied, use the bounded compensation RPC. A schema
-- rollback may revoke the three public RPCs, then drop their private helpers
-- and the empty audit table only when no correction record exists.
