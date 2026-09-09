create table public.os_planning_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  event_type text,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  description text,
  assignment_rules jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(slug, version)
);

create table public.os_planning_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.os_planning_templates(id) on delete cascade,
  section_key text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  condition jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, section_key)
);

create table public.os_planning_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.os_planning_sections(id) on delete cascade,
  question_key text not null,
  label text not null,
  help_text text,
  field_type text not null check (field_type in ('short_text','long_text','email','phone','date','time','datetime','number','currency','yes_no','single_select','multi_select','song','person','address','file','repeater')),
  is_required boolean not null default false,
  sort_order integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  condition jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  writeback_fact_key text,
  prefill_sources jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(section_id, question_key)
);

create table public.os_planning_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  template_id uuid not null references public.os_planning_templates(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned','opened','in_progress','submitted','reopened','locked','archived')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  current_section_key text,
  assigned_at timestamptz not null default now(),
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  last_saved_at timestamptz,
  submitted_at timestamptz,
  locked_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, template_id)
);

create table public.os_planning_answers (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.os_planning_assignments(id) on delete cascade,
  question_key text not null,
  value jsonb not null default 'null'::jsonb,
  source text not null default 'client' check (source in ('builder','client','owner','staff','import','system')),
  is_confirmed boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id, question_key)
);

create table public.os_message_threads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  subject text,
  thread_type text not null default 'client' check (thread_type in ('client','staff','vendor','system')),
  status text not null default 'open' check (status in ('open','closed','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.os_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.os_message_threads(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_contact_id uuid references public.os_contacts(id) on delete set null,
  visibility text not null default 'shared' check (visibility in ('shared','staff_only','client_only')),
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_user_id is not null or sender_contact_id is not null)
);

create table public.os_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.os_events(id) on delete cascade,
  contact_id uuid references public.os_contacts(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  visibility text not null default 'staff' check (visibility in ('staff','client','shared','system')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.os_automation_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.os_events(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled')),
  idempotency_key text,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index os_activity_events_idempotency_unique on public.os_activity_events(idempotency_key) where idempotency_key is not null;
create unique index os_automation_outbox_idempotency_unique on public.os_automation_outbox(idempotency_key) where idempotency_key is not null;
create index os_planning_answers_assignment_idx on public.os_planning_answers(assignment_id, updated_at desc);
create index os_messages_thread_sent_idx on public.os_messages(thread_id, sent_at);
create index os_activity_events_event_time_idx on public.os_activity_events(event_id, occurred_at desc);
create index os_automation_outbox_pending_idx on public.os_automation_outbox(status, available_at) where status in ('pending','failed');

create trigger os_planning_templates_updated_at before update on public.os_planning_templates for each row execute function public.os_set_updated_at();
create trigger os_planning_sections_updated_at before update on public.os_planning_sections for each row execute function public.os_set_updated_at();
create trigger os_planning_questions_updated_at before update on public.os_planning_questions for each row execute function public.os_set_updated_at();
create trigger os_planning_assignments_updated_at before update on public.os_planning_assignments for each row execute function public.os_set_updated_at();
create trigger os_planning_answers_updated_at before update on public.os_planning_answers for each row execute function public.os_set_updated_at();
create trigger os_message_threads_updated_at before update on public.os_message_threads for each row execute function public.os_set_updated_at();
create trigger os_messages_updated_at before update on public.os_messages for each row execute function public.os_set_updated_at();
create trigger os_automation_outbox_updated_at before update on public.os_automation_outbox for each row execute function public.os_set_updated_at();