alter table public.os_planning_answers add column question_id uuid references public.os_planning_questions(id) on delete set null;
create index os_planning_answers_question_idx on public.os_planning_answers(question_id) where question_id is not null;

create or replace function public.os_has_event_access(target_event_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.os_is_staff() or exists (
    select 1
    from public.os_event_members em
    where em.event_id = target_event_id
      and em.user_id = auth.uid()
      and em.is_active
  );
$$;

create or replace function public.os_has_contact_access(target_contact_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.os_is_staff() or exists (
    select 1
    from public.os_contact_users cu
    where cu.contact_id = target_contact_id
      and cu.user_id = auth.uid()
  );
$$;

create or replace function public.os_has_assignment_access(target_assignment_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.os_is_staff() or exists (
    select 1
    from public.os_planning_assignments pa
    join public.os_event_members em on em.event_id = pa.event_id
    where pa.id = target_assignment_id
      and em.user_id = auth.uid()
      and em.is_active
  );
$$;

create or replace function private.os_emit_event(
  target_event_id uuid,
  target_event_type text,
  target_payload jsonb,
  target_idempotency_key text,
  target_visibility text default 'staff'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.os_activity_events(event_id,event_type,visibility,payload,idempotency_key)
  values(target_event_id,target_event_type,target_visibility,coalesce(target_payload,'{}'::jsonb),target_idempotency_key)
  on conflict (idempotency_key) where idempotency_key is not null do nothing;

  insert into public.os_automation_outbox(event_id,event_type,payload,idempotency_key)
  values(target_event_id,target_event_type,coalesce(target_payload,'{}'::jsonb),target_idempotency_key)
  on conflict (idempotency_key) where idempotency_key is not null do nothing;
end;
$$;
revoke all on function private.os_emit_event(uuid,text,jsonb,text,text) from public, anon, authenticated;

create or replace function private.os_guard_planning_answer_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.os_is_staff() then
    new.source := 'client';
    new.updated_by := auth.uid();
    new.is_confirmed := false;
  end if;
  return new;
end;
$$;
revoke all on function private.os_guard_planning_answer_write() from public, anon, authenticated;

create or replace function private.os_sync_planning_answer_fact()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_event_id uuid;
  target_question_id uuid;
  target_fact_key text;
begin
  select pa.event_id, pq.id, pq.writeback_fact_key
    into target_event_id, target_question_id, target_fact_key
  from public.os_planning_assignments pa
  join public.os_planning_sections ps on ps.template_id = pa.template_id
  join public.os_planning_questions pq on pq.section_id = ps.id and pq.question_key = new.question_key
  where pa.id = new.assignment_id
  order by ps.sort_order, pq.sort_order
  limit 1;

  if new.question_id is null and target_question_id is not null then
    update public.os_planning_answers set question_id = target_question_id where id = new.id and question_id is null;
  end if;

  if target_event_id is not null and target_fact_key is not null then
    insert into public.os_event_facts(event_id,fact_key,value,source,source_reference,is_confirmed,updated_by,updated_at)
    values(target_event_id,target_fact_key,new.value,new.source,'planning_answer:' || new.id::text,new.is_confirmed,new.updated_by,now())
    on conflict(event_id,fact_key) do update set
      value = excluded.value,
      source = excluded.source,
      source_reference = excluded.source_reference,
      is_confirmed = excluded.is_confirmed,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;
  return new;
end;
$$;
revoke all on function private.os_sync_planning_answer_fact() from public, anon, authenticated;

create or replace function private.os_track_quote_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.os_emit_event(
      new.event_id,
      'quote.accepted',
      jsonb_build_object('quote_version_id',new.id,'version_number',new.version_number,'total_amount',new.total_amount,'deposit_amount',new.deposit_amount),
      'quote:' || new.id::text || ':accepted',
      'shared'
    );
  end if;
  return new;
end;
$$;
revoke all on function private.os_track_quote_acceptance() from public, anon, authenticated;

create or replace function private.os_track_booking_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.os_emit_event(
      new.event_id,
      'booking.confirmed',
      jsonb_build_object('booking_id',new.id,'accepted_quote_version_id',new.accepted_quote_version_id,'booked_at',new.booked_at),
      'booking:' || new.id::text || ':confirmed',
      'shared'
    );
  end if;
  return new;
end;
$$;
revoke all on function private.os_track_booking_confirmation() from public, anon, authenticated;

create or replace function private.os_track_planning_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prior_progress integer := 0;
begin
  if tg_op = 'UPDATE' then
    prior_progress := old.progress_percent;
  end if;

  if new.first_opened_at is not null and (tg_op = 'INSERT' or old.first_opened_at is null) then
    perform private.os_emit_event(new.event_id,'planning.opened',jsonb_build_object('assignment_id',new.id),'planning:' || new.id::text || ':opened','staff');
  end if;
  if prior_progress < 25 and new.progress_percent >= 25 then
    perform private.os_emit_event(new.event_id,'planning.25_percent',jsonb_build_object('assignment_id',new.id,'progress_percent',new.progress_percent),'planning:' || new.id::text || ':25','staff');
  end if;
  if prior_progress < 50 and new.progress_percent >= 50 then
    perform private.os_emit_event(new.event_id,'planning.50_percent',jsonb_build_object('assignment_id',new.id,'progress_percent',new.progress_percent),'planning:' || new.id::text || ':50','staff');
  end if;
  if prior_progress < 75 and new.progress_percent >= 75 then
    perform private.os_emit_event(new.event_id,'planning.75_percent',jsonb_build_object('assignment_id',new.id,'progress_percent',new.progress_percent),'planning:' || new.id::text || ':75','staff');
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.os_emit_event(new.event_id,'planning.submitted',jsonb_build_object('assignment_id',new.id,'submitted_at',new.submitted_at),'planning:' || new.id::text || ':submitted','shared');
  end if;
  return new;
end;
$$;
revoke all on function private.os_track_planning_progress() from public, anon, authenticated;

create trigger os_planning_answer_guard before insert or update on public.os_planning_answers for each row execute function private.os_guard_planning_answer_write();
create trigger os_planning_answer_fact_sync after insert or update on public.os_planning_answers for each row execute function private.os_sync_planning_answer_fact();
create trigger os_quote_acceptance_event after insert or update on public.os_quote_versions for each row execute function private.os_track_quote_acceptance();
create trigger os_booking_confirmation_event after insert or update on public.os_bookings for each row execute function private.os_track_booking_confirmation();
create trigger os_planning_progress_event after insert or update on public.os_planning_assignments for each row execute function private.os_track_planning_progress();