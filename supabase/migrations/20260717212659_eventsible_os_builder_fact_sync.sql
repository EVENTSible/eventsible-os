create or replace function private.os_set_builder_fact(
  target_event_id uuid,
  target_fact_key text,
  target_value jsonb,
  target_submission_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if target_value is null or target_value = 'null'::jsonb then
    return;
  end if;

  insert into public.os_event_facts(event_id,fact_key,value,source,source_reference,is_confirmed)
  values(
    target_event_id,
    target_fact_key,
    target_value,
    'builder',
    'builder_submission:' || target_submission_id::text,
    false
  )
  on conflict(event_id,fact_key)
  do update set
    value = excluded.value,
    source = excluded.source,
    source_reference = excluded.source_reference,
    updated_at = now()
  where public.os_event_facts.source in ('builder','system')
    and public.os_event_facts.is_confirmed = false;
end;
$$;
revoke all on function private.os_set_builder_fact(uuid,text,jsonb,uuid) from public, anon, authenticated;

create or replace function private.os_sync_builder_facts_for_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_event public.os_events%rowtype;
  target_submission public.os_builder_submissions%rowtype;
  payload jsonb;
begin
  select * into target_event from public.os_events where id=target_event_id;
  if not found or target_event.builder_submission_id is null then return; end if;

  select * into target_submission
  from public.os_builder_submissions
  where id=target_event.builder_submission_id;
  if not found then return; end if;

  payload := coalesce(target_submission.normalized_payload,'{}'::jsonb);

  perform private.os_set_builder_fact(target_event_id,'event.type',coalesce(payload->'event_type',to_jsonb(target_event.event_type)),target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'event.title',coalesce(payload->'event_title',to_jsonb(target_event.title)),target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'event.guest_count',coalesce(payload->'guest_count',to_jsonb(target_event.guest_count)),target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'event.requested_date',payload->'event_date',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'event.requested_start_time',payload->'start_time',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'event.requested_end_time',payload->'end_time',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'experience.goal',payload->'what_matters_most',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'experience.age_range',payload->'age_range',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'experience.theme',payload->'theme',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'experience.interactive_activities',payload->'interactive_activities',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'music.clean_required',payload->'clean_music_required',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'music.preferences',payload->'music_preferences',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'ceremony.included',payload->'ceremony_needed',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'ceremony.location',payload->'ceremony_location',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'venue.outdoor',payload->'outdoor',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'venue.access_time',payload->'venue_access_time',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'venue.power_available',payload->'power_available',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'venue.wifi_available',payload->'wifi_available',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'builder.selected_services',payload->'selected_services',target_submission.id);
  perform private.os_set_builder_fact(target_event_id,'builder.full_submission',payload,target_submission.id);
end;
$$;
revoke all on function private.os_sync_builder_facts_for_event(uuid) from public, anon, authenticated;

create or replace function private.os_sync_builder_facts_from_event_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.os_sync_builder_facts_for_event(new.id);
  return new;
end;
$$;
revoke all on function private.os_sync_builder_facts_from_event_trigger() from public, anon, authenticated;

create or replace function private.os_sync_builder_facts_from_submission_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare related_event record;
begin
  for related_event in select id from public.os_events where builder_submission_id=new.id loop
    perform private.os_sync_builder_facts_for_event(related_event.id);
  end loop;
  return new;
end;
$$;
revoke all on function private.os_sync_builder_facts_from_submission_trigger() from public, anon, authenticated;

create trigger os_events_builder_fact_sync
after insert or update of builder_submission_id,guest_count,starts_at,ends_at,venue_name,venue_address_1,venue_city,venue_state,venue_postal_code
on public.os_events
for each row execute function private.os_sync_builder_facts_from_event_trigger();

create trigger os_builder_submission_fact_sync
after update of normalized_payload,status on public.os_builder_submissions
for each row execute function private.os_sync_builder_facts_from_submission_trigger();