create table if not exists public.os_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.os_events(id) on delete cascade,
  lead_id uuid references public.os_leads(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'follow_up' check (task_type in ('follow_up','planning','contract','payment','staff','event_day','custom')),
  status text not null default 'todo' check (status in ('todo','in_progress','waiting','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  remind_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (event_id is not null or lead_id is not null or task_type in ('staff','custom'))
);

create index if not exists os_tasks_due_at_idx on public.os_tasks(due_at) where status not in ('completed','cancelled');
create index if not exists os_tasks_event_id_idx on public.os_tasks(event_id);
create index if not exists os_tasks_lead_id_idx on public.os_tasks(lead_id);
create index if not exists os_tasks_assigned_to_idx on public.os_tasks(assigned_to);
create unique index if not exists os_tasks_idempotency_idx on public.os_tasks((metadata->>'idempotency_key')) where metadata ? 'idempotency_key';

drop trigger if exists os_tasks_set_updated_at on public.os_tasks;
create trigger os_tasks_set_updated_at before update on public.os_tasks for each row execute function public.os_set_updated_at();

alter table public.os_tasks enable row level security;

drop policy if exists os_tasks_staff_select on public.os_tasks;
create policy os_tasks_staff_select on public.os_tasks for select to authenticated using (public.os_is_staff());

drop policy if exists os_tasks_staff_insert on public.os_tasks;
create policy os_tasks_staff_insert on public.os_tasks for insert to authenticated with check (public.os_is_staff() and (created_by is null or created_by = auth.uid()));

drop policy if exists os_tasks_staff_update on public.os_tasks;
create policy os_tasks_staff_update on public.os_tasks for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());

drop policy if exists os_tasks_staff_delete on public.os_tasks;
create policy os_tasks_staff_delete on public.os_tasks for delete to authenticated using (public.os_is_staff());

grant select, insert, update, delete on public.os_tasks to authenticated;
revoke all on public.os_tasks from anon;

drop view if exists public.os_task_board_v;
create view public.os_task_board_v with (security_invoker=true) as
select
  t.id as task_id,
  t.event_id,
  t.lead_id,
  t.title,
  t.description,
  t.task_type,
  t.status,
  t.priority,
  t.due_at,
  t.remind_at,
  t.assigned_to,
  assigned.display_name as assigned_to_name,
  t.created_by,
  creator.display_name as created_by_name,
  t.completed_at,
  t.metadata,
  t.created_at,
  t.updated_at,
  e.title as event_title,
  e.event_type,
  e.status as event_status,
  e.starts_at as event_starts_at,
  e.venue_name,
  c.display_name as client_name,
  c.primary_email as client_email,
  c.primary_phone as client_phone,
  l.status as lead_status,
  case
    when t.status in ('completed','cancelled') then false
    when t.due_at is null then false
    when t.due_at < now() then true
    else false
  end as is_overdue,
  case
    when t.status in ('completed','cancelled') then 'closed'
    when t.due_at is null then 'unscheduled'
    when t.due_at < now() then 'overdue'
    when t.due_at < now() + interval '24 hours' then 'due_soon'
    when t.due_at < now() + interval '7 days' then 'this_week'
    else 'upcoming'
  end as due_bucket
from public.os_tasks t
left join public.os_events e on e.id = t.event_id
left join public.os_contacts c on c.id = e.primary_contact_id
left join public.os_leads l on l.id = t.lead_id
left join public.os_profiles assigned on assigned.id = t.assigned_to
left join public.os_profiles creator on creator.id = t.created_by;

grant select on public.os_task_board_v to authenticated;
revoke all on public.os_task_board_v from anon;

comment on table public.os_tasks is 'Internal EVENTSible follow-up, planning, payment, contract, staff, and event-day tasks.';
comment on view public.os_task_board_v is 'Staff-only task board enriched with event, client, and due-state details.';