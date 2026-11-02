-- Source-only migration. Apply only after a separately approved Production schema change.
-- The public server action invokes this with service_role; no browser role can execute it.
create or replace function public.os_submit_public_wedding_hero(p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_draft uuid := (p_input->>'draftId')::uuid;
  v_submission uuid := (p_input->>'submissionId')::uuid;
  v_assignment public.os_planning_assignments%rowtype;
  v_event public.os_events%rowtype;
  v_contact uuid;
  v_template uuid;
  v_now timestamptz := now();
  v_settings jsonb;
  v_history jsonb;
  v_prior jsonb;
  v_answer record;
  v_question uuid;
  v_name text := left(p_input->>'contactName', 160);
  v_couple text := left(p_input->>'coupleNames', 320);
  v_date text := left(p_input->>'eventDate', 80);
  v_activity jsonb;
begin
  if v_draft is null or v_submission is null or jsonb_typeof(p_input->'answers') <> 'object'
    or pg_catalog.length((p_input->'answers')::text) > 300000 or v_name is null or pg_catalog.length(v_name) < 2
    or (p_input->>'mode') not in ('guided','form','print')
    or (p_input->>'progress')::integer not between 0 and 100 then
    raise exception 'Invalid public Wedding Hero submission';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_draft::text, 0));
  select * into v_assignment from public.os_planning_assignments
    where settings->>'public_draft_id' = v_draft::text for update;
  if found then
    select * into v_event from public.os_events where id = v_assignment.event_id for update;
    if v_event.id is null or v_event.source <> 'wedding_hero_public_submission'
      or v_event.status <> 'inquiry' or v_event.settings->>'public_draft_id' <> v_draft::text then
      return '{"state":"managed"}'::jsonb;
    end if;
    v_history := coalesce(v_assignment.settings->'wedding_hero_submissions','[]'::jsonb);
    select x into v_prior from pg_catalog.jsonb_array_elements(v_history) x where x->>'submission_id' = v_submission::text limit 1;
    if v_prior is not null then
      return pg_catalog.jsonb_build_object('state','duplicate','eventId',v_assignment.event_id,'assignmentId',v_assignment.id,'submittedAt',v_prior->>'submitted_at');
    end if;
    v_contact := v_event.primary_contact_id;
    update public.os_events set title = coalesce(nullif(v_couple,''),v_name) || ' wedding',
      settings = settings || pg_catalog.jsonb_build_object('wedding_date_from_planner',nullif(v_date,'')) where id = v_event.id;
    if v_contact is not null then
      update public.os_contacts set display_name = v_name, primary_email = p_input->>'email', primary_phone = p_input->>'phone'
        where id = v_contact and source = 'wedding_hero_public_submission' and status <> 'archived';
    end if;
  else
    select id into v_template from public.os_planning_templates where slug = 'wedding-hero' and status = 'published' order by version desc limit 1;
    if v_template is null then raise exception 'Wedding Hero template unavailable'; end if;
    insert into public.os_contacts(first_name,last_name,display_name,primary_email,primary_phone,source,status,metadata)
      values (pg_catalog.split_part(v_name,' ',1),nullif(pg_catalog.btrim(pg_catalog.substr(v_name,pg_catalog.length(pg_catalog.split_part(v_name,' ',1))+1)),''),
        v_name,p_input->>'email',p_input->>'phone','wedding_hero_public_submission','active',
        pg_catalog.jsonb_build_object('source','wedding_hero_public_submission','public_draft_id',v_draft,'contact_unverified',true)) returning id into v_contact;
    insert into public.os_events(primary_contact_id,title,event_type,status,timezone,source,settings)
      values (v_contact,coalesce(nullif(v_couple,''),v_name) || ' wedding','Wedding','inquiry','America/Indiana/Indianapolis',
        'wedding_hero_public_submission',pg_catalog.jsonb_build_object('source','wedding_hero_public_submission','public_draft_id',v_draft,'contact_unverified',true,'wedding_date_from_planner',nullif(v_date,''))) returning * into v_event;
    insert into public.os_planning_assignments(event_id,template_id,status,progress_percent,current_section_key,first_opened_at,last_opened_at,last_saved_at,settings)
      values(v_event.id,v_template,'in_progress',(p_input->>'progress')::integer,p_input->>'sectionKey',v_now,v_now,v_now,
        pg_catalog.jsonb_build_object('source',p_input->>'companionVersion','intake_source','wedding_hero_public_submission','public_draft_id',v_draft,'contact_unverified',true)) returning * into v_assignment;
    insert into public.os_leads(contact_id,event_id,status,source,inquiry_summary,metadata)
      values(v_contact,v_event.id,'new','wedding_hero_public_submission','Wedding Hero plan submitted by ' || v_name || '.',
        pg_catalog.jsonb_build_object('planning_assignment_id',v_assignment.id,'public_draft_id',v_draft,'contact_unverified',true));
    v_history := '[]'::jsonb;
  end if;

  for v_answer in select key,value from pg_catalog.jsonb_each(p_input->'answers') loop
    select q.id into v_question from public.os_planning_questions q join public.os_planning_sections s on s.id = q.section_id
      where s.template_id = v_assignment.template_id and q.question_key = v_answer.key limit 1;
    insert into public.os_planning_answers(assignment_id,question_id,question_key,value,source,is_confirmed)
      values(v_assignment.id,v_question,v_answer.key,v_answer.value,'client',false)
      on conflict(assignment_id,question_key) do update set question_id = excluded.question_id, value = excluded.value, source = 'client', is_confirmed = false;
  end loop;
  v_settings := v_assignment.settings || pg_catalog.jsonb_build_object('source',p_input->>'companionVersion','intake_source','wedding_hero_public_submission',
    'public_draft_id',v_draft,'latest_submission_id',v_submission,
    'wedding_hero_submissions',(select pg_catalog.jsonb_agg(x) from (
      select x from pg_catalog.jsonb_array_elements(v_history || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'submission_id',v_submission,'submitted_at',v_now,'progress_percent',(p_input->>'progress')::integer,
        'mode',p_input->>'mode','contact_name',v_name,'email',p_input->>'email','phone',p_input->>'phone'))) with ordinality a(x,n)
      order by n desc limit 20) z));
  update public.os_planning_assignments set status = 'submitted', progress_percent = (p_input->>'progress')::integer,
    current_section_key = p_input->>'sectionKey',last_opened_at = v_now,last_saved_at = v_now,submitted_at = v_now,settings = v_settings
    where id = v_assignment.id;
  v_activity := pg_catalog.jsonb_build_object('summary','Public Wedding Hero plan submitted for EVENTSible review.',
    'assignment_id',v_assignment.id,'submission_id',v_submission,'submitted_at',v_now,
    'progress_percent',(p_input->>'progress')::integer,'mode',p_input->>'mode','source','wedding_hero_public_submission');
  if v_assignment.status = 'submitted' then
    insert into public.os_activity_events(event_id,contact_id,event_type,visibility,payload,idempotency_key)
      values(v_event.id,v_contact,'planning.submitted','staff',v_activity,'wedding-hero-submission:' || v_submission::text)
      on conflict(idempotency_key) where idempotency_key is not null do nothing;
  else
    update public.os_activity_events set contact_id = v_contact,visibility = 'staff',payload = v_activity
      where idempotency_key = 'planning:' || v_assignment.id::text || ':submitted';
  end if;
  return pg_catalog.jsonb_build_object('state','submitted','eventId',v_event.id,'assignmentId',v_assignment.id,'submittedAt',v_now);
end;
$$;
revoke all on function public.os_submit_public_wedding_hero(jsonb) from public, anon, authenticated;
grant execute on function public.os_submit_public_wedding_hero(jsonb) to service_role;
