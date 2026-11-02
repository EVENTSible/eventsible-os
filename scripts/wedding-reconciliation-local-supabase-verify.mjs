import { spawnSync } from "node:child_process";

const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/^postgresql?:\/\/[^/]*127\.0\.0\.1:54322\/postgres$/.test(databaseUrl)) throw new Error("Disposable local Supabase database required.");

const sql = `
begin;
do $verify$
declare
  v_input jsonb := '{"draftId":"a1000000-0000-4000-8000-000000000001","submissionId":"a1000000-0000-4000-8000-000000000002","contactName":"Synthetic Wedding Client","email":"synthetic@example.invalid","mode":"form","sectionKey":"event_basics","answers":{"partner_one_name":"Synthetic","ceremony_included":true},"progress":60,"coupleNames":"Synthetic Couple","eventDate":"2026-11-07","companionVersion":"synthetic-test"}'::jsonb;
  v_response jsonb;
  v_source uuid;
  v_assignment uuid;
  v_target uuid := 'a1000000-0000-4000-8000-000000000003';
  v_lead uuid;
  v_outbox uuid[];
  v_answers integer;
  v_facts integer;
  v_activity integer;
begin
  insert into public.os_events(id,title,event_type,status,timezone)
    values(v_target,'Synthetic booked wedding','Wedding','booked','America/Chicago');
  v_response := public.os_submit_public_wedding_hero(v_input);
  if v_response->>'state' <> 'submitted' then raise exception 'First public submission failed: %',v_response; end if;
  v_source := (v_response->>'eventId')::uuid;
  v_assignment := (v_response->>'assignmentId')::uuid;
  if (public.os_submit_public_wedding_hero(v_input))->>'state' <> 'duplicate' then raise exception 'Duplicate submission was not idempotent'; end if;
  select id into v_lead from public.os_leads where event_id = v_source;
  select pg_catalog.array_agg(id order by id) into v_outbox from public.os_automation_outbox where event_id = v_source;
  select count(*) into v_answers from public.os_planning_answers where assignment_id = v_assignment;
  select count(*) into v_facts from public.os_event_facts where event_id = v_source;
  select count(*) into v_activity from public.os_activity_events where event_id = v_source;
  if v_answers <> 2 or v_facts < 1 or pg_catalog.array_length(v_outbox,1) < 1 then raise exception 'Public submission relationships incomplete'; end if;
  v_response := public.os_reconcile_wedding_hero(v_source,v_target,v_assignment,v_lead,v_outbox,v_answers,v_facts,v_activity);
  if v_response->>'state' <> 'reconciled' then raise exception 'Reconciliation failed: %',v_response; end if;
  if (public.os_reconcile_wedding_hero(v_source,v_target,v_assignment,v_lead,v_outbox,v_answers,v_facts,v_activity))->>'state' <> 'already_reconciled' then raise exception 'Reconciliation retry not idempotent'; end if;
  if (public.os_submit_public_wedding_hero(v_input))->>'state' <> 'managed' then raise exception 'Retired public draft was writable'; end if;
  if (select count(*) from public.os_planning_answers where assignment_id = v_assignment) <> v_answers
    or (select count(*) from public.os_event_facts where event_id = v_target) <> v_facts
    or (select count(*) from public.os_automation_outbox where event_id = v_source and status = 'quarantined') <> pg_catalog.array_length(v_outbox,1)
    or (select count(*) from public.os_activity_events where event_id = v_source) <> v_activity then
    raise exception 'Reconciliation lost answers, facts, outbox or source history';
  end if;
  v_response := public.os_rollback_wedding_hero_reconciliation(v_assignment);
  if v_response->>'state' <> 'rolled_back' then raise exception 'Rollback failed: %',v_response; end if;
  if (select event_id from public.os_planning_assignments where id = v_assignment) <> v_source
    or (select count(*) from public.os_event_facts where event_id = v_source) <> v_facts
    or (select count(*) from public.os_automation_outbox where event_id = v_source and status = 'pending') <> pg_catalog.array_length(v_outbox,1)
    or (select status from public.os_events where id = v_source) <> 'inquiry' then
    raise exception 'Rollback did not restore the source state';
  end if;
end;
$verify$;
rollback;
`;

const result = spawnSync("psql", [databaseUrl, "--no-password", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1"], {
  input: sql, encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" },
});
if (result.status !== 0) throw new Error(`Local wedding transaction verification failed: ${String(result.stderr ?? "").slice(0, 800)}`);
console.log("PASS: isolated public submission, idempotency, reconciliation, retired draft and guarded rollback; transaction rolled back.");
