-- Centralize the EVENTSible HQ role/capability contract and narrow direct
-- staff mutations. Existing client/public policies continue to decide access
-- for non-staff users; these restrictive policies only remove excess power
-- from recognized staff roles.

create or replace function public.os_staff_role()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('owner', 'manager', 'staff', 'host')
      then auth.jwt() -> 'app_metadata' ->> 'role'
    else null
  end;
$$;

create or replace function public.os_has_hq_capability(p_capability text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case public.os_staff_role()
    when 'owner' then p_capability = any (array[
      'hq.read', 'lead.lifecycle.manage', 'quote.approve', 'gig.convert',
      'client.activate', 'import.candidate.create', 'import.review',
      'import.finalize', 'event.operations.write', 'event.notes.write',
      'task.write', 'catalog.manage', 'planning.structure.manage',
      'data.delete', 'staff.manage', 'system.manage'
    ]::text[])
    when 'manager' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write',
      'event.notes.write', 'task.write'
    ]::text[])
    when 'staff' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write',
      'event.notes.write', 'task.write'
    ]::text[])
    when 'host' then p_capability = any (array[
      'hq.read', 'import.review', 'event.operations.write',
      'event.notes.write', 'task.write'
    ]::text[])
    else false
  end;
$$;

create or replace function public.os_is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.os_staff_role() = 'owner';
$$;

revoke all on function public.os_staff_role() from public, anon;
revoke all on function public.os_has_hq_capability(text) from public, anon;
revoke all on function public.os_is_owner() from public, anon;
grant execute on function public.os_staff_role() to authenticated, service_role;
grant execute on function public.os_has_hq_capability(text) to authenticated, service_role;
grant execute on function public.os_is_owner() to authenticated, service_role;

-- All existing direct DELETE paths remain governed by their original policy,
-- and are additionally restricted so recognized staff must be Owners. This
-- preserves any deliberately scoped client self-service behavior.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'os_booking_services', 'os_bookings', 'os_builder_intake_requests',
    'os_builder_submissions', 'os_contact_users', 'os_contacts',
    'os_event_facts', 'os_event_members', 'os_event_notes',
    'os_event_page_messages', 'os_event_page_modules', 'os_event_pages',
    'os_events', 'os_files', 'os_import_batches',
    'os_planning_assignments', 'os_planning_questions',
    'os_planning_sections', 'os_planning_templates', 'os_quote_items',
    'os_quote_versions', 'os_rsvps', 'os_service_catalog', 'os_tasks',
    'os_leads'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using ((not public.os_is_staff()) or public.os_has_hq_capability(''data.delete''))',
      v_table || '_hq_delete_boundary', v_table
    );
  end loop;
end;
$$;

-- Direct INSERT/UPDATE privileges are Owner-only for recognized staff. Normal
-- Manager/Staff/Host event operations use the existing fixed-purpose RPCs.
do $$
declare
  v_table text;
  v_command text;
begin
  foreach v_table in array array[
    'os_booking_services', 'os_bookings', 'os_builder_intake_requests',
    'os_builder_submissions', 'os_contact_users', 'os_contacts',
    'os_event_facts', 'os_event_import_candidates', 'os_event_members',
    'os_event_notes', 'os_event_page_messages', 'os_event_page_modules',
    'os_event_pages', 'os_events', 'os_files', 'os_import_batches',
    'os_message_threads', 'os_messages', 'os_planning_answers',
    'os_planning_assignments', 'os_planning_questions',
    'os_planning_sections', 'os_planning_templates', 'os_profiles',
    'os_quote_items', 'os_quote_versions', 'os_rsvps',
    'os_service_catalog', 'os_leads'
  ] loop
    foreach v_command in array array['insert', 'update'] loop
      if exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = v_table and cmd = upper(v_command)
      ) then
        execute format(
          'create policy %I on public.%I as restrictive for %s to authenticated %s',
          v_table || '_hq_' || v_command || '_boundary',
          v_table,
          v_command,
          case when v_command = 'insert'
            then 'with check ((not public.os_is_staff()) or public.os_is_owner())'
            else 'using ((not public.os_is_staff()) or public.os_is_owner()) with check ((not public.os_is_staff()) or public.os_is_owner())'
          end
        );
      end if;
    end loop;
  end loop;
end;
$$;

-- Tasks are the one direct table-write exception for bounded operational roles.
create policy os_tasks_hq_insert_boundary
on public.os_tasks as restrictive for insert to authenticated
with check ((not public.os_is_staff()) or public.os_has_hq_capability('task.write'));

create policy os_tasks_hq_update_boundary
on public.os_tasks as restrictive for update to authenticated
using ((not public.os_is_staff()) or public.os_has_hq_capability('task.write'))
with check ((not public.os_is_staff()) or public.os_has_hq_capability('task.write'));

-- Owner bootstrap state may contain system-administration details.
create policy os_owner_bootstrap_owner_read_boundary
on public.os_owner_bootstrap_state as restrictive for select to authenticated
using (public.os_is_owner());

-- Manager/Staff/Host may change only the four review fields through this
-- bounded RPC. Direct candidate updates are Owner-only for recognized staff.
create or replace function public.os_review_event_import_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_matched_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_candidate public.os_event_import_candidates%rowtype;
begin
  if v_actor_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if not public.os_has_hq_capability('import.review') then
    raise exception using errcode = '42501', message = 'Import review access is required.';
  end if;
  if p_candidate_id is null or p_decision not in ('pending', 'review_later', 'ignored', 'matched') then
    raise exception using errcode = '22023', message = 'A valid candidate and review decision are required.';
  end if;
  if (p_decision = 'matched') <> (p_matched_event_id is not null) then
    raise exception using errcode = '22023', message = 'Matched reviews require exactly one canonical event.';
  end if;

  select * into v_candidate
  from public.os_event_import_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The import candidate was not found.';
  end if;
  if v_candidate.review_status = 'imported' then
    raise exception using errcode = '22023', message = 'An imported candidate cannot be reviewed again.';
  end if;
  if p_matched_event_id is not null and not exists (
    select 1 from public.os_events where id = p_matched_event_id
  ) then
    raise exception using errcode = '23503', message = 'The matched canonical event was not found.';
  end if;

  update public.os_event_import_candidates
  set review_status = p_decision,
      reviewed_by_user_id = case when p_decision = 'pending' then null else v_actor_user_id end,
      reviewed_at = case when p_decision = 'pending' then null else now() end,
      matched_event_id = case when p_decision = 'matched' then p_matched_event_id else null end
  where id = p_candidate_id;

  return jsonb_build_object(
    'status', 'updated',
    'candidate_id', p_candidate_id,
    'review_status', p_decision,
    'matched_event_id', case when p_decision = 'matched' then p_matched_event_id else null end
  );
end;
$$;

revoke all on function public.os_review_event_import_candidate(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.os_review_event_import_candidate(uuid, text, uuid) to authenticated;

-- Final import is Owner-only. The original transactional implementation stays
-- canonical but is no longer directly executable by authenticated browsers.
create or replace function public.os_finalize_existing_gig_import(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if not public.os_has_hq_capability('import.finalize') then
    raise exception using errcode = '42501', message = 'Owner approval is required.';
  end if;
  return public.os_import_existing_gig(p_candidate_id);
end;
$$;

revoke all on function public.os_import_existing_gig(uuid) from authenticated;
revoke all on function public.os_finalize_existing_gig_import(uuid) from public, anon, authenticated;
grant execute on function public.os_finalize_existing_gig_import(uuid) to authenticated;

-- Rollback summary (intentionally not executed): drop the *_hq_*_boundary
-- policies and the owner bootstrap boundary; drop the two new wrapper RPCs;
-- grant authenticated execute on os_import_existing_gig(uuid); then drop
-- os_is_owner(), os_has_hq_capability(text), and os_staff_role(). No row data
-- is created, updated, backfilled, or deleted by this migration.
