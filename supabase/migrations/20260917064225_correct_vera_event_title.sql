-- Correct only the reviewed Vera event title used by the bounded
-- Vera/Warren maintenance workflow. The private snapshot, fingerprint,
-- and exact-record preconditions from migration 20260917032706 remain
-- unchanged.

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
    'vera',jsonb_build_object('eventId','4c277aa1-fbcd-4422-ba6b-7ce294a32ea5','currentTitle','Warren 70th Birthday Karaoke','correctedTitle','70th Birthday Karaoke','date','2026-08-22','timezone','America/Chicago','time','6:00 PM–10:30 PM Central'),
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

  update public.os_events set title='70th Birthday Karaoke',updated_at=now()
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
  if not exists (select 1 from public.os_events where id=v_correction.target_event_id and title='70th Birthday Karaoke')
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

alter function public.os_preview_vera_warren_correction() owner to postgres;
alter function public.os_apply_vera_warren_correction(text,text) owner to postgres;
alter function public.os_compensate_vera_warren_correction(text,text) owner to postgres;
revoke all on function public.os_preview_vera_warren_correction() from public, anon, authenticated;
revoke all on function public.os_apply_vera_warren_correction(text,text) from public, anon, authenticated;
revoke all on function public.os_compensate_vera_warren_correction(text,text) from public, anon, authenticated;
grant execute on function public.os_preview_vera_warren_correction() to authenticated;
grant execute on function public.os_apply_vera_warren_correction(text,text) to authenticated;
grant execute on function public.os_compensate_vera_warren_correction(text,text) to authenticated;
