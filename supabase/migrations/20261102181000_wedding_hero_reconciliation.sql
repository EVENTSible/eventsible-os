-- Source-only, Owner-approved execution contract. Never call this from an automatic request.
-- All locks and writes are one database transaction. An error rolls back every change.
create or replace function public.os_reconcile_wedding_hero(
  p_source uuid, p_target uuid, p_assignment uuid, p_lead uuid,
  p_outbox uuid[], p_answers integer, p_facts integer, p_source_activity integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_assignment public.os_planning_assignments%rowtype;
  v_source public.os_events%rowtype;
  v_target public.os_events%rowtype;
  v_draft text;
  v_outbox uuid[];
  v_count integer;
  v_fact_ids uuid[];
  v_lead_metadata jsonb;
  v_outbox_before jsonb;
begin
  if p_source = p_target or p_assignment is null or p_lead is null or p_outbox is null or pg_catalog.array_length(p_outbox,1) is null then
    raise exception 'Incomplete reconciliation scope';
  end if;
  select settings->>'public_draft_id' into v_draft from public.os_planning_assignments where id = p_assignment;
  if v_draft is null then raise exception 'Public draft missing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_draft,0));
  select * into v_assignment from public.os_planning_assignments where id = p_assignment for update;
  if v_assignment.event_id = p_target then
    select * into v_target from public.os_events where id = p_target;
    if v_target.settings->>'wedding_hero_source_event_id' = p_source::text then
      return pg_catalog.jsonb_build_object('state','already_reconciled','eventId',p_target,'assignmentId',p_assignment);
    end if;
    raise exception 'Assignment already linked without matching reconciliation audit';
  end if;
  if exists(select 1 from public.os_activity_events where idempotency_key = 'wedding-hero-reconciled:' || p_assignment::text) then
    raise exception 'Prior reconciliation audit exists; re-run requires a new reviewed contract';
  end if;
  if v_assignment.event_id is distinct from p_source or v_assignment.status <> 'submitted' then raise exception 'Planning assignment changed'; end if;
  select * into v_source from public.os_events where id = p_source for update;
  select * into v_target from public.os_events where id = p_target for update;
  if v_source.status <> 'inquiry' or v_source.source <> 'wedding_hero_public_submission'
    or v_source.settings->>'public_draft_id' <> v_draft or v_target.status <> 'booked'
    or exists(select 1 from public.os_planning_assignments where event_id = p_target and template_id = v_assignment.template_id)
    or exists(select 1 from public.os_event_facts f join public.os_event_facts t on t.event_id = p_target and t.fact_key = f.fact_key where f.event_id = p_source)
    or exists(select 1 from public.os_event_members where event_id = p_source) then
    raise exception 'Event identity, access or fact conflict needs Owner review';
  end if;
  select count(*) into v_count from public.os_planning_answers where assignment_id = p_assignment;
  if v_count <> p_answers then raise exception 'Answer count changed'; end if;
  select count(*),pg_catalog.array_agg(id order by id) into v_count,v_fact_ids from public.os_event_facts where event_id = p_source;
  if v_count <> p_facts then raise exception 'Fact count changed'; end if;
  select count(*) into v_count from public.os_activity_events where event_id = p_source;
  if v_count <> p_source_activity then raise exception 'Source history changed'; end if;
  select count(*) into v_count from public.os_leads where event_id = p_source and id = p_lead and status = 'new';
  if v_count <> 1 or (select count(*) from public.os_leads where event_id = p_source) <> 1 then raise exception 'Lead disposition changed'; end if;
  -- Wait for any in-flight worker, then reject status drift instead of racing a send.
  perform 1 from public.os_automation_outbox where event_id = p_source for update;
  select pg_catalog.array_agg(id order by id) into v_outbox from public.os_automation_outbox where event_id = p_source and status = 'pending' and attempt_count = 0;
  if v_outbox is distinct from (select pg_catalog.array_agg(outbox_id order by outbox_id) from pg_catalog.unnest(p_outbox) as scoped(outbox_id))
    or (select count(*) from public.os_automation_outbox where event_id = p_source) <> pg_catalog.array_length(p_outbox,1) then
    raise exception 'Outbox disposition changed; review all pending work';
  end if;
  select metadata into v_lead_metadata from public.os_leads where id = p_lead;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'status',status,'last_error',last_error) order by id)
    into v_outbox_before from public.os_automation_outbox where event_id = p_source;
  update public.os_automation_outbox set status = 'quarantined',last_error = 'Owner reconciliation: pending planning automation requires separate review'
    where id = any(p_outbox);
  update public.os_leads set status = 'archived',metadata = metadata || pg_catalog.jsonb_build_object('reconciled_into_event_id',p_target)
    where id = p_lead;
  update public.os_event_facts set event_id = p_target where event_id = p_source;
  update public.os_planning_assignments set event_id = p_target,
    settings = settings || pg_catalog.jsonb_build_object('reconciled_from_event_id',p_source,'public_draft_retired',true) where id = p_assignment;
  update public.os_events set status = 'archived',settings = settings || pg_catalog.jsonb_build_object('reconciled_into_event_id',p_target)
    where id = p_source;
  update public.os_events set settings = settings || pg_catalog.jsonb_build_object('wedding_hero_source_event_id',p_source,'wedding_hero_assignment_id',p_assignment)
    where id = p_target;
  insert into public.os_activity_events(event_id,event_type,visibility,idempotency_key,payload)
    values(p_target,'planning.reconciled','staff','wedding-hero-reconciled:' || p_assignment::text,
      pg_catalog.jsonb_build_object('source_event_id',p_source,'assignment_id',p_assignment,'lead_id',p_lead,
        'outbox_ids',p_outbox,'fact_ids',v_fact_ids,'answer_count',p_answers,'source_activity_count',p_source_activity,
        'before',pg_catalog.jsonb_build_object('source_status',v_source.status,'source_settings',v_source.settings,
          'target_settings',v_target.settings,'assignment_settings',v_assignment.settings,
          'lead_metadata',v_lead_metadata,'outbox',v_outbox_before)))
    on conflict(idempotency_key) where idempotency_key is not null do nothing;
  return pg_catalog.jsonb_build_object('state','reconciled','eventId',p_target,'assignmentId',p_assignment,
    'answers',p_answers,'facts',p_facts,'sourceActivityPreserved',p_source_activity,'outboxQuarantined',pg_catalog.array_length(p_outbox,1));
end;
$$;
revoke all on function public.os_reconcile_wedding_hero(uuid,uuid,uuid,uuid,uuid[],integer,integer,integer) from public,anon,authenticated;
grant execute on function public.os_reconcile_wedding_hero(uuid,uuid,uuid,uuid,uuid[],integer,integer,integer) to service_role;

-- Separate, explicitly approved inverse. Refuses rollback if any covered row changed after the audit.
create or replace function public.os_rollback_wedding_hero_reconciliation(p_assignment uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_audit public.os_activity_events%rowtype;
  v_source uuid;
  v_target uuid;
  v_lead uuid;
  v_draft text;
  v_before jsonb;
  v_item jsonb;
  v_ids uuid[];
begin
  select * into v_audit from public.os_activity_events
    where idempotency_key = 'wedding-hero-reconciled:' || p_assignment::text and event_type = 'planning.reconciled';
  if v_audit.id is null then raise exception 'Reconciliation audit missing'; end if;
  v_source := (v_audit.payload->>'source_event_id')::uuid;
  v_target := v_audit.event_id;
  v_lead := (v_audit.payload->>'lead_id')::uuid;
  v_before := v_audit.payload->'before';
  v_draft := v_before->'assignment_settings'->>'public_draft_id';
  if v_draft is null then raise exception 'Original public draft missing'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_draft,0));
  perform 1 from public.os_planning_assignments where id = p_assignment for update;
  perform 1 from public.os_events where id in (v_source,v_target) for update;
  perform 1 from public.os_automation_outbox where id in
    (select (value->>'id')::uuid from pg_catalog.jsonb_array_elements(v_before->'outbox') as items(value)) for update;
  select pg_catalog.array_agg(id order by id) into v_ids from public.os_event_facts
    where event_id = v_target and id = any(select value::uuid from pg_catalog.jsonb_array_elements_text(v_audit.payload->'fact_ids') as items(value));
  if v_ids is distinct from (select pg_catalog.array_agg(value::uuid order by value::uuid) from pg_catalog.jsonb_array_elements_text(v_audit.payload->'fact_ids') as items(value))
    or not exists(select 1 from public.os_events where id = v_source and status = 'archived' and settings->>'reconciled_into_event_id' = v_target::text and updated_at <= v_audit.occurred_at)
    or not exists(select 1 from public.os_events where id = v_target and status = 'booked' and settings->>'wedding_hero_assignment_id' = p_assignment::text and updated_at <= v_audit.occurred_at)
    or not exists(select 1 from public.os_planning_assignments where id = p_assignment and event_id = v_target and updated_at <= v_audit.occurred_at)
    or exists(select 1 from public.os_planning_answers where assignment_id = p_assignment and updated_at > v_audit.occurred_at)
    or exists(select 1 from public.os_event_facts where id = any(v_ids) and updated_at > v_audit.occurred_at)
    or not exists(select 1 from public.os_leads where id = v_lead and status = 'archived' and updated_at <= v_audit.occurred_at)
    or exists(select 1 from public.os_automation_outbox where event_id = v_source and (status <> 'quarantined' or updated_at > v_audit.occurred_at)) then
    raise exception 'Covered records changed; manual Owner rollback review required';
  end if;
  update public.os_planning_assignments set event_id = v_source,settings = v_before->'assignment_settings' where id = p_assignment;
  update public.os_event_facts set event_id = v_source where id = any(v_ids);
  update public.os_leads set status = 'new',metadata = v_before->'lead_metadata' where id = v_lead;
  for v_item in select value from pg_catalog.jsonb_array_elements(v_before->'outbox') as items(value) loop
    update public.os_automation_outbox set status = v_item->>'status',last_error = v_item->>'last_error'
      where id = (v_item->>'id')::uuid;
  end loop;
  update public.os_events set status = v_before->>'source_status',settings = v_before->'source_settings' where id = v_source;
  update public.os_events set settings = v_before->'target_settings' where id = v_target;
  insert into public.os_activity_events(event_id,event_type,visibility,idempotency_key,payload)
    values(v_target,'planning.reconciliation_rolled_back','staff','wedding-hero-rollback:' || p_assignment::text,
      pg_catalog.jsonb_build_object('source_event_id',v_source,'assignment_id',p_assignment));
  return pg_catalog.jsonb_build_object('state','rolled_back','sourceEventId',v_source,'targetEventId',v_target,'assignmentId',p_assignment);
end;
$$;
revoke all on function public.os_rollback_wedding_hero_reconciliation(uuid) from public,anon,authenticated;
grant execute on function public.os_rollback_wedding_hero_reconciliation(uuid) to service_role;
