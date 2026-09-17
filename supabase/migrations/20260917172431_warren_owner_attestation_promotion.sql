-- Owner-only promotion of the exact unresolved Warren review candidate.
-- The contact name and phone are supplied at apply time and checked against
-- one-way reviewed hashes so private contact information is not committed.

create table public.os_owner_candidate_promotion_scopes (
  promotion_key text primary key,
  candidate_id uuid not null unique,
  expected_contact_name_hash text not null,
  expected_phone_hash text not null,
  created_at timestamptz not null default now(),
  constraint os_owner_candidate_promotion_scopes_key_chk check (
    promotion_key ~ '^[a-z0-9][a-z0-9._:-]{0,119}$'
  ),
  constraint os_owner_candidate_promotion_scopes_hash_chk check (
    expected_contact_name_hash ~ '^[a-f0-9]{64}$'
    and expected_phone_hash ~ '^[a-f0-9]{64}$'
  )
);

insert into public.os_owner_candidate_promotion_scopes(
  promotion_key,candidate_id,expected_contact_name_hash,expected_phone_hash
) values (
  'warren-owner-attestation-v1',
  '15ce422a-18e3-4a53-a005-2e5a919be572',
  '14da90f26b6d757dba6b536410f8e3751eeb8cedd55c41adb5aeff3982abc988',
  '55526d98ae04eaca5961db795e575fc2c18a91d1ec82e790cc7e09c6ac7d3dc1'
);

create table public.os_owner_candidate_promotion_audits (
  id uuid primary key default gen_random_uuid(),
  promotion_key text not null unique references public.os_owner_candidate_promotion_scopes(promotion_key) on delete restrict,
  candidate_id uuid not null unique references public.os_event_import_candidates(id) on delete restrict,
  status text not null default 'ready',
  before_fingerprint text not null,
  after_fingerprint text,
  before_image jsonb not null,
  after_image jsonb,
  created_contact_id uuid references public.os_contacts(id) on delete restrict,
  created_lead_id uuid references public.os_leads(id) on delete restrict,
  created_event_id uuid references public.os_events(id) on delete restrict,
  created_booking_id uuid references public.os_bookings(id) on delete restrict,
  applied_activity_id uuid references public.os_activity_events(id) on delete restrict,
  compensated_activity_id uuid references public.os_activity_events(id) on delete restrict,
  applied_by uuid references auth.users(id) on delete restrict,
  applied_at timestamptz,
  compensated_by uuid references auth.users(id) on delete restrict,
  compensated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_owner_candidate_promotion_audits_status_chk check (
    status in ('ready','applied','compensated')
  ),
  constraint os_owner_candidate_promotion_audits_before_hash_chk check (
    before_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint os_owner_candidate_promotion_audits_after_hash_chk check (
    after_fingerprint is null or after_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint os_owner_candidate_promotion_audits_state_chk check (
    (status='ready' and applied_by is null and applied_at is null and compensated_by is null and compensated_at is null)
    or (status='applied' and applied_by is not null and applied_at is not null and compensated_by is null and compensated_at is null)
    or (status='compensated' and applied_by is not null and applied_at is not null and compensated_by is not null and compensated_at is not null)
  )
);

create index os_owner_candidate_promotion_audits_applied_by_idx
  on public.os_owner_candidate_promotion_audits(applied_by) where applied_by is not null;
create index os_owner_candidate_promotion_audits_compensated_by_idx
  on public.os_owner_candidate_promotion_audits(compensated_by) where compensated_by is not null;

create trigger os_owner_candidate_promotion_audits_updated_at
before update on public.os_owner_candidate_promotion_audits
for each row execute function public.os_set_updated_at();

alter table public.os_owner_candidate_promotion_scopes enable row level security;
alter table public.os_owner_candidate_promotion_audits enable row level security;
revoke all on table public.os_owner_candidate_promotion_scopes from public, anon, authenticated;
revoke all on table public.os_owner_candidate_promotion_audits from public, anon, authenticated;
grant all on table public.os_owner_candidate_promotion_scopes to service_role;
grant all on table public.os_owner_candidate_promotion_audits to service_role;

create or replace function private.os_warren_owner_attestation_duplicate_scan()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with scope as (
    select expected_contact_name_hash,expected_phone_hash
    from public.os_owner_candidate_promotion_scopes
    where promotion_key='warren-owner-attestation-v1'
  )
  select jsonb_build_object(
    'contacts',coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'status',c.status) order by c.id)
      from public.os_contacts c
      where encode(extensions.digest(convert_to('+'||regexp_replace(coalesce(c.primary_phone,''),'[^0-9]','','g'),'UTF8'),'sha256'),'hex')=(select expected_phone_hash from scope)
         or encode(extensions.digest(convert_to(lower(btrim(coalesce(c.display_name,''))),'UTF8'),'sha256'),'hex')=(select expected_contact_name_hash from scope)
    ),'[]'::jsonb),
    'leads',coalesce((
      select jsonb_agg(jsonb_build_object('id',l.id,'status',l.status,'contactId',l.contact_id,'eventId',l.event_id) order by l.id)
      from public.os_leads l
      join public.os_contacts c on c.id=l.contact_id
      left join public.os_events e on e.id=l.event_id
      where encode(extensions.digest(convert_to('+'||regexp_replace(coalesce(c.primary_phone,''),'[^0-9]','','g'),'UTF8'),'sha256'),'hex')=(select expected_phone_hash from scope)
         or encode(extensions.digest(convert_to(lower(btrim(coalesce(c.display_name,''))),'UTF8'),'sha256'),'hex')=(select expected_contact_name_hash from scope)
         or (lower(btrim(coalesce(e.title,'')))=lower('Warren’s 70th Birthday')
             and (e.starts_at at time zone coalesce(e.timezone,'America/Indiana/Indianapolis'))::date='2026-09-26'::date)
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'contactId',e.primary_contact_id) order by e.id)
      from public.os_events e
      where (
        lower(btrim(e.title))=lower('Warren’s 70th Birthday')
        or lower(btrim(coalesce(e.venue_name,'')))=lower('Wingate by Wyndham')
      ) and (e.starts_at at time zone coalesce(e.timezone,'America/Indiana/Indianapolis'))::date='2026-09-26'::date
    ),'[]'::jsonb),
    'bookings',coalesce((
      select jsonb_agg(jsonb_build_object('id',b.id,'status',b.status,'eventId',b.event_id) order by b.id)
      from public.os_bookings b
      join public.os_events e on e.id=b.event_id
      where (
        lower(btrim(e.title))=lower('Warren’s 70th Birthday')
        or lower(btrim(coalesce(e.venue_name,'')))=lower('Wingate by Wyndham')
      ) and (e.starts_at at time zone coalesce(e.timezone,'America/Indiana/Indianapolis'))::date='2026-09-26'::date
    ),'[]'::jsonb),
    'otherCandidates',coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'reviewStatus',c.review_status) order by c.id)
      from public.os_event_import_candidates c
      where c.id<>'15ce422a-18e3-4a53-a005-2e5a919be572'::uuid
        and (
          lower(btrim(coalesce(c.proposed_data->>'title','')))=lower('Warren’s 70th Birthday')
          or (c.proposed_data->>'event_date'='2026-09-26' and lower(btrim(coalesce(c.proposed_data->>'venue_name','')))=lower('Wingate by Wyndham'))
        )
    ),'[]'::jsonb)
  );
$$;
revoke all on function private.os_warren_owner_attestation_duplicate_scan() from public, anon, authenticated;

create or replace function private.os_warren_owner_attestation_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'candidate',(select to_jsonb(c) from public.os_event_import_candidates c where c.id='15ce422a-18e3-4a53-a005-2e5a919be572'::uuid),
    'duplicates',private.os_warren_owner_attestation_duplicate_scan(),
    'created',jsonb_build_object(
      'contact',(select to_jsonb(c) from public.os_contacts c where c.metadata->>'ownerAttestationPromotionKey'='warren-owner-attestation-v1'),
      'lead',(select to_jsonb(l) from public.os_leads l where l.metadata->>'ownerAttestationPromotionKey'='warren-owner-attestation-v1'),
      'event',(select to_jsonb(e) from public.os_events e where e.settings->>'ownerAttestationPromotionKey'='warren-owner-attestation-v1'),
      'booking',(select to_jsonb(b) from public.os_bookings b where b.metadata->>'ownerAttestationPromotionKey'='warren-owner-attestation-v1'),
      'activities',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.os_activity_events a where a.idempotency_key like 'owner_candidate_promotion:warren-owner-attestation-v1:%'),'[]'::jsonb)
    ),
    'protected',jsonb_build_object(
      'veraCorrection',(select to_jsonb(c) from public.os_owner_maintenance_corrections c where c.correction_key='vera-warren-separation-v1'),
      'importBatch',(select to_jsonb(b) from public.os_import_batches b where b.id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid),
      'importItemCount',(select count(*) from public.os_import_batch_items i where i.batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid),
      'importItemDigest',(select encode(extensions.digest(convert_to(coalesce(string_agg(i.id::text||':'||i.item_key||':'||i.status||':'||i.canonical_record_ids::text,'|' order by i.id),''),'UTF8'),'sha256'),'hex') from public.os_import_batch_items i where i.batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid)
    )
  );
$$;
revoke all on function private.os_warren_owner_attestation_snapshot() from public, anon, authenticated;

create or replace function private.os_warren_owner_attestation_fingerprint()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(private.os_warren_owner_attestation_snapshot()::text,'UTF8'),'sha256'),'hex');
$$;
revoke all on function private.os_warren_owner_attestation_fingerprint() from public, anon, authenticated;

create or replace function private.os_assert_warren_owner_attestation_before_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.os_event_import_candidates%rowtype;
  v_duplicates jsonb;
begin
  select * into v_candidate from public.os_event_import_candidates
  where id='15ce422a-18e3-4a53-a005-2e5a919be572'::uuid for update;
  if not found then raise exception 'Reviewed Warren candidate is unavailable' using errcode='P0002'; end if;
  if v_candidate.contract_version<>'existing_gig_candidate_v1'
    or v_candidate.source<>'owner_correction'
    or v_candidate.external_reference<>'warren-70th-birthday:2026-09-26'
    or v_candidate.review_status<>'pending'
    or v_candidate.matched_event_id is not null
    or v_candidate.imported_event_id is not null
    or v_candidate.imported_contact_id is not null
    or v_candidate.imported_booking_id is not null
    or v_candidate.proposed_data->>'title'<>'Warren’s 70th Birthday'
    or v_candidate.proposed_data->>'event_date'<>'2026-09-26'
    or v_candidate.proposed_data->>'venue_name'<>'Wingate by Wyndham'
    or v_candidate.proposed_data->>'review_state'<>'unresolved_calendar_evidence'
    or v_candidate.proposed_data->>'canonicalization_blocked'<>'true'
  then raise exception 'Reviewed Warren candidate preconditions changed' using errcode='40001'; end if;
  if not exists (
    select 1 from public.os_owner_maintenance_corrections c
    where c.correction_key='vera-warren-separation-v1'
      and c.status='applied'
      and c.review_candidate_id=v_candidate.id
      and c.target_event_id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid
      and c.import_batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid
  ) or not exists (
    select 1 from public.os_events e
    where e.id='4c277aa1-fbcd-4422-ba6b-7ce294a32ea5'::uuid and e.title='70th Birthday Karaoke'
  ) then raise exception 'Protected Vera correction preconditions changed' using errcode='40001'; end if;
  if not exists (
    select 1 from public.os_import_batches b
    where b.id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid
      and b.status='completed' and b.contract_version='intake_manifest_v2'
      and b.row_count=243 and b.created_count=243
  ) or (select count(*) from public.os_import_batch_items i where i.batch_id='4beb47eb-3087-4e51-9fda-ddb2eaa84893'::uuid)<>243
  then raise exception 'Completed import history preconditions changed' using errcode='40001'; end if;
  v_duplicates:=private.os_warren_owner_attestation_duplicate_scan();
  if jsonb_array_length(v_duplicates->'contacts')<>0
    or jsonb_array_length(v_duplicates->'leads')<>0
    or jsonb_array_length(v_duplicates->'events')<>0
    or jsonb_array_length(v_duplicates->'bookings')<>0
    or jsonb_array_length(v_duplicates->'otherCandidates')<>0
  then raise exception 'Potential canonical duplicate requires Owner review' using errcode='23505', detail=v_duplicates::text; end if;
  return private.os_warren_owner_attestation_snapshot();
end;
$$;
revoke all on function private.os_assert_warren_owner_attestation_before_state() from public, anon, authenticated;

-- Keep the existing complete-import suppression guard and add only this exact,
-- audited promotion as a second authorized suppression context.
create or replace function private.os_validate_complete_import_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch uuid;
begin
  if coalesce(new.metadata->>'suppressAutomations','false') <> 'true' then return new; end if;
  if new.metadata->>'ownerAttestationPromotionKey'='warren-owner-attestation-v1'
    and auth.uid() is not null
    and public.os_has_hq_capability('data.readiness.manage')
    and exists (
      select 1 from public.os_owner_candidate_promotion_audits a
      where a.promotion_key='warren-owner-attestation-v1'
        and a.candidate_id='15ce422a-18e3-4a53-a005-2e5a919be572'::uuid
        and (
          (a.status='ready' and a.applied_by is null)
          or (a.status='applied' and a.applied_by is not null and a.compensated_by is null)
        )
    )
  then return new; end if;
  begin v_batch := (new.metadata->>'importBatchId')::uuid;
  exception when others then raise exception 'Invalid import automation suppression' using errcode='42501'; end;
  if auth.uid() is null or not public.os_has_hq_capability('data.readiness.manage') or not exists (
    select 1 from public.os_import_batches b
    where b.id=v_batch and b.contract_version='intake_manifest_v2' and b.status='importing' and b.approved_by=auth.uid()
  ) then raise exception 'Import automation suppression is not authorized' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.os_validate_complete_import_booking() from public, anon, authenticated;

create or replace function public.os_preview_warren_owner_attestation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_audit public.os_owner_candidate_promotion_audits%rowtype;
  v_snapshot jsonb;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  select * into v_audit from public.os_owner_candidate_promotion_audits where promotion_key='warren-owner-attestation-v1';
  if found then
    return jsonb_build_object('status',v_audit.status,'promotionId',v_audit.id,'candidateId',v_audit.candidate_id,'currentFingerprint',private.os_warren_owner_attestation_fingerprint(),'afterFingerprint',v_audit.after_fingerprint);
  end if;
  v_snapshot:=private.os_assert_warren_owner_attestation_before_state();
  return jsonb_build_object(
    'status','ready',
    'candidateId','15ce422a-18e3-4a53-a005-2e5a919be572',
    'currentFingerprint',encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex'),
    'requiredConfirmation','PROMOTE WARREN OWNER ATTESTATION',
    'contact',jsonb_build_object('displayName','Owner-attested private contact','phone','Owner-attested private phone','email',null),
    'event',jsonb_build_object('title','Warren’s 70th Birthday','eventType','birthday_party','status','booked','date','2026-09-26','startsAt','2026-09-26T21:00:00Z','endsAt','2026-09-27T02:00:00Z','timezone','America/Indiana/Indianapolis','venue','Wingate by Wyndham','city','South Bend','state','Indiana','streetAddress',null),
    'booking',jsonb_build_object('status','confirmed','contractedTotal',300.00,'amountReceived',0.00,'deposit',null,'balanceDue',300.00,'paymentStatus','unpaid','serviceLines',0),
    'audit',jsonb_build_object('evidenceClassification','Owner attestation by Travis','activityRecords',1),
    'duplicates',v_snapshot->'duplicates',
    'expectedCountChanges',jsonb_build_object('contacts',1,'leads',1,'events',1,'bookings',1,'activities',1,'services',0,'paymentFacts',0,'staffAssignments',0,'provenance',0,'candidates',0),
    'protected',jsonb_build_object('veraEventId','4c277aa1-fbcd-4422-ba6b-7ce294a32ea5','importBatchId','4beb47eb-3087-4e51-9fda-ddb2eaa84893','importItems',243,'notifications',0,'outboxRows',0)
  );
end;
$$;

create or replace function public.os_apply_warren_owner_attestation(
  p_expected_fingerprint text,
  p_contact_display_name text,
  p_normalized_phone text,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_scope public.os_owner_candidate_promotion_scopes%rowtype;
  v_existing public.os_owner_candidate_promotion_audits%rowtype;
  v_before jsonb;
  v_before_fingerprint text;
  v_after jsonb;
  v_after_fingerprint text;
  v_audit_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_event_id uuid;
  v_booking_id uuid;
  v_activity_id uuid;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_confirmation<>'PROMOTE WARREN OWNER ATTESTATION' then raise exception 'Exact promotion confirmation required' using errcode='22023'; end if;
  if lower(coalesce(p_expected_fingerprint,'')) !~ '^[a-f0-9]{64}$' then raise exception 'Valid preview fingerprint required' using errcode='22023'; end if;
  if coalesce(p_contact_display_name,'') !~ '^[[:alpha:]][[:alpha:] .''-]{1,119}$' then raise exception 'Reviewed contact name is required' using errcode='22023'; end if;
  if coalesce(p_normalized_phone,'') !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Reviewed normalized phone is required' using errcode='22023'; end if;
  select * into v_scope from public.os_owner_candidate_promotion_scopes where promotion_key='warren-owner-attestation-v1';
  if not found
    or encode(extensions.digest(convert_to(lower(btrim(p_contact_display_name)),'UTF8'),'sha256'),'hex')<>v_scope.expected_contact_name_hash
    or encode(extensions.digest(convert_to(p_normalized_phone,'UTF8'),'sha256'),'hex')<>v_scope.expected_phone_hash
  then raise exception 'Contact does not match reviewed Owner attestation' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('eventsible.owner_candidate_promotion.warren.v1',0));
  perform pg_advisory_xact_lock(hashtextextended('eventsible.complete_intake.native_compatibility',0));
  select * into v_existing from public.os_owner_candidate_promotion_audits where promotion_key='warren-owner-attestation-v1' for update;
  if found then
    if v_existing.status='applied' and v_existing.after_fingerprint=private.os_warren_owner_attestation_fingerprint() then
      return jsonb_build_object('status','replayed','promotionId',v_existing.id,'candidateId',v_existing.candidate_id,'contactId',v_existing.created_contact_id,'leadId',v_existing.created_lead_id,'eventId',v_existing.created_event_id,'bookingId',v_existing.created_booking_id,'afterFingerprint',v_existing.after_fingerprint);
    end if;
    raise exception 'Promotion audit state does not permit application' using errcode='40001';
  end if;

  v_before:=private.os_assert_warren_owner_attestation_before_state();
  v_before_fingerprint:=encode(extensions.digest(convert_to(v_before::text,'UTF8'),'sha256'),'hex');
  if v_before_fingerprint<>lower(p_expected_fingerprint) then raise exception 'Promotion preview is stale' using errcode='40001'; end if;

  insert into public.os_owner_candidate_promotion_audits(promotion_key,candidate_id,status,before_fingerprint,before_image)
  values('warren-owner-attestation-v1',v_scope.candidate_id,'ready',v_before_fingerprint,v_before)
  returning id into v_audit_id;

  insert into public.os_contacts(first_name,last_name,display_name,primary_email,primary_phone,preferred_channel,source,status,metadata,created_by)
  values(split_part(p_contact_display_name,' ',1),nullif(substr(p_contact_display_name,length(split_part(p_contact_display_name,' ',1))+2),''),p_contact_display_name,null,p_normalized_phone,'phone','owner_attestation','active',jsonb_build_object('ownerAttestationPromotionKey','warren-owner-attestation-v1','candidateId',v_scope.candidate_id),v_actor)
  returning id into v_contact_id;

  insert into public.os_events(primary_contact_id,title,event_type,status,starts_at,ends_at,timezone,venue_name,venue_address_1,venue_city,venue_state,venue_country,source,settings,created_by)
  values(v_contact_id,'Warren’s 70th Birthday','birthday_party','booked','2026-09-26T21:00:00Z'::timestamptz,'2026-09-27T02:00:00Z'::timestamptz,'America/Indiana/Indianapolis','Wingate by Wyndham',null,'South Bend','Indiana','US','owner_attestation',jsonb_build_object('ownerAttestationPromotionKey','warren-owner-attestation-v1','candidateId',v_scope.candidate_id,'evidenceClassification','owner_attestation'),v_actor)
  returning id into v_event_id;

  insert into public.os_leads(contact_id,event_id,status,source,inquiry_summary,estimated_value,metadata)
  values(v_contact_id,v_event_id,'won','owner_attestation','Owner-attested historical booked birthday event.',300.00,jsonb_build_object('ownerAttestationPromotionKey','warren-owner-attestation-v1','candidateId',v_scope.candidate_id))
  returning id into v_lead_id;

  insert into public.os_bookings(event_id,status,booked_at,contract_status,payment_status,total_amount,deposit_amount,balance_due,balance_due_at,metadata)
  values(v_event_id,'confirmed',null,'not_sent','unpaid',300.00,null,300.00,null,jsonb_build_object('ownerAttestationPromotionKey','warren-owner-attestation-v1','candidateId',v_scope.candidate_id,'amountReceived',0.00,'evidenceClassification','owner_attestation','suppressAutomations',true))
  returning id into v_booking_id;

  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
  values(v_event_id,v_contact_id,v_actor,'data_readiness.owner_attested_candidate_promoted','staff',jsonb_build_object('promotionId',v_audit_id,'candidateId',v_scope.candidate_id,'evidenceClassification','Owner attestation by Travis','createdLeadId',v_lead_id,'createdBookingId',v_booking_id,'serviceLineCount',0,'paymentFactCount',0,'staffAssignmentCount',0),'owner_candidate_promotion:warren-owner-attestation-v1:apply')
  returning id into v_activity_id;

  update public.os_event_import_candidates
  set review_status='imported',reviewed_by_user_id=v_actor,reviewed_at=now(),matched_event_id=null,
      imported_contact_id=v_contact_id,imported_event_id=v_event_id,imported_booking_id=v_booking_id
  where id=v_scope.candidate_id and review_status='pending';
  if not found then raise exception 'Warren candidate changed during promotion' using errcode='40001'; end if;

  update public.os_bookings set metadata=metadata-'suppressAutomations'
  where id=v_booking_id and metadata->>'suppressAutomations'='true';
  if not found then raise exception 'Booking automation guard changed during promotion' using errcode='40001'; end if;

  v_after:=private.os_warren_owner_attestation_snapshot();
  v_after_fingerprint:=encode(extensions.digest(convert_to(v_after::text,'UTF8'),'sha256'),'hex');
  update public.os_owner_candidate_promotion_audits
  set status='applied',after_fingerprint=v_after_fingerprint,after_image=v_after,
      created_contact_id=v_contact_id,created_lead_id=v_lead_id,created_event_id=v_event_id,created_booking_id=v_booking_id,
      applied_activity_id=v_activity_id,applied_by=v_actor,applied_at=now()
  where id=v_audit_id;

  return jsonb_build_object('status','applied','promotionId',v_audit_id,'candidateId',v_scope.candidate_id,'contactId',v_contact_id,'leadId',v_lead_id,'eventId',v_event_id,'bookingId',v_booking_id,'activityId',v_activity_id,'beforeFingerprint',v_before_fingerprint,'afterFingerprint',v_after_fingerprint,'serviceLinesCreated',0,'paymentFactsCreated',0,'staffAssignmentsCreated',0,'notificationsCreated',0,'outboxRowsCreated',0);
end;
$$;

create or replace function public.os_compensate_warren_owner_attestation(
  p_expected_after_fingerprint text,
  p_confirmation text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid:=auth.uid();
  v_audit public.os_owner_candidate_promotion_audits%rowtype;
  v_current_fingerprint text;
  v_activity_id uuid;
begin
  if v_actor is null or not public.os_has_hq_capability('data.readiness.manage') then raise exception 'Owner authorization required' using errcode='42501'; end if;
  if p_confirmation<>'COMPENSATE WARREN OWNER ATTESTATION' then raise exception 'Exact compensation confirmation required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eventsible.owner_candidate_promotion.warren.v1',0));
  perform pg_advisory_xact_lock(hashtextextended('eventsible.complete_intake.native_compatibility',0));
  select * into v_audit from public.os_owner_candidate_promotion_audits where promotion_key='warren-owner-attestation-v1' for update;
  if not found then raise exception 'Promotion audit was not found' using errcode='P0002'; end if;
  if v_audit.status='compensated' then return jsonb_build_object('status','replayed','promotionId',v_audit.id,'candidateId',v_audit.candidate_id); end if;
  if v_audit.status<>'applied' then raise exception 'Promotion is not eligible for compensation' using errcode='40001'; end if;
  v_current_fingerprint:=private.os_warren_owner_attestation_fingerprint();
  if v_current_fingerprint<>v_audit.after_fingerprint or v_current_fingerprint<>lower(coalesce(p_expected_after_fingerprint,'')) then raise exception 'Promotion state changed after application' using errcode='40001'; end if;
  if not exists(select 1 from public.os_contacts where id=v_audit.created_contact_id and status='active' and metadata->>'ownerAttestationPromotionKey'='warren-owner-attestation-v1')
    or not exists(select 1 from public.os_leads where id=v_audit.created_lead_id and status='won' and contact_id=v_audit.created_contact_id and event_id=v_audit.created_event_id)
    or not exists(select 1 from public.os_events where id=v_audit.created_event_id and status='booked' and primary_contact_id=v_audit.created_contact_id)
    or not exists(select 1 from public.os_bookings where id=v_audit.created_booking_id and status='confirmed' and event_id=v_audit.created_event_id)
    or not exists(select 1 from public.os_event_import_candidates where id=v_audit.candidate_id and review_status='imported' and imported_contact_id=v_audit.created_contact_id and imported_event_id=v_audit.created_event_id and imported_booking_id=v_audit.created_booking_id)
  then raise exception 'Promoted records changed after application' using errcode='40001'; end if;

  update public.os_bookings set status='cancelled',metadata=metadata||jsonb_build_object('compensatedPromotion',true,'suppressAutomations',true)
  where id=v_audit.created_booking_id;
  update public.os_bookings set metadata=metadata-'suppressAutomations' where id=v_audit.created_booking_id;
  update public.os_leads set status='archived',metadata=metadata||jsonb_build_object('compensatedPromotion',true) where id=v_audit.created_lead_id;
  update public.os_events set status='archived',settings=settings||jsonb_build_object('compensatedPromotion',true) where id=v_audit.created_event_id;
  update public.os_contacts set status='archived',metadata=metadata||jsonb_build_object('compensatedPromotion',true) where id=v_audit.created_contact_id;

  update public.os_event_import_candidates
  set proposed_data=v_audit.before_image->'candidate'->'proposed_data',
      review_status=v_audit.before_image->'candidate'->>'review_status',
      reviewed_by_user_id=nullif(v_audit.before_image->'candidate'->>'reviewed_by_user_id','')::uuid,
      reviewed_at=nullif(v_audit.before_image->'candidate'->>'reviewed_at','')::timestamptz,
      matched_event_id=nullif(v_audit.before_image->'candidate'->>'matched_event_id','')::uuid,
      imported_event_id=nullif(v_audit.before_image->'candidate'->>'imported_event_id','')::uuid,
      imported_contact_id=nullif(v_audit.before_image->'candidate'->>'imported_contact_id','')::uuid,
      imported_booking_id=nullif(v_audit.before_image->'candidate'->>'imported_booking_id','')::uuid
  where id=v_audit.candidate_id;

  insert into public.os_activity_events(event_id,contact_id,actor_user_id,event_type,visibility,payload,idempotency_key)
  values(v_audit.created_event_id,v_audit.created_contact_id,v_actor,'data_readiness.owner_attested_candidate_compensated','staff',jsonb_build_object('promotionId',v_audit.id,'candidateId',v_audit.candidate_id,'createdRecordsArchived',true,'candidateBeforeImageRestored',true),'owner_candidate_promotion:warren-owner-attestation-v1:compensate')
  returning id into v_activity_id;
  update public.os_owner_candidate_promotion_audits
  set status='compensated',compensated_activity_id=v_activity_id,compensated_by=v_actor,compensated_at=now()
  where id=v_audit.id;
  return jsonb_build_object('status','compensated','promotionId',v_audit.id,'candidateId',v_audit.candidate_id,'archivedContactId',v_audit.created_contact_id,'archivedLeadId',v_audit.created_lead_id,'archivedEventId',v_audit.created_event_id,'cancelledBookingId',v_audit.created_booking_id,'activityId',v_activity_id);
end;
$$;

revoke all on function public.os_preview_warren_owner_attestation() from public, anon, authenticated;
revoke all on function public.os_apply_warren_owner_attestation(text,text,text,text) from public, anon, authenticated;
revoke all on function public.os_compensate_warren_owner_attestation(text,text) from public, anon, authenticated;
grant execute on function public.os_preview_warren_owner_attestation() to authenticated;
grant execute on function public.os_apply_warren_owner_attestation(text,text,text,text) to authenticated;
grant execute on function public.os_compensate_warren_owner_attestation(text,text) to authenticated;

-- Rollback: revoke the three public RPCs. If a promotion was applied, use the
-- bounded compensation RPC. Drop the private helpers and empty audit/scope
-- tables only after confirming no audit row exists; never delete business or
-- audit history to reverse an applied promotion.
