-- EVENTSible Builder submission internal email notification foundation.
--
-- Scope:
-- - Adds an OS-owned delivery log for internal Builder lead notification emails.
-- - Keeps email delivery outside public.os_ingest_builder_submission(jsonb).
-- - Does not mutate CRM, contact, lead, event, quote, booking, activity, or outbox data.
-- - Does not activate unrelated outbox consumers.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.os_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null,
  notification_type text not null,
  source_event_id uuid references public.os_integration_outbox(id),
  builder_submission_id uuid,
  recipient_email text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  last_safe_error text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_notification_deliveries_type_chk check (
    notification_type in ('builder_lead_internal_email')
  ),
  constraint os_notification_deliveries_status_chk check (
    status in ('queued', 'sending', 'sent', 'dry_run', 'retry', 'failed', 'skipped')
  ),
  constraint os_notification_deliveries_attempts_chk check (
    attempt_count >= 0 and max_attempts > 0 and attempt_count <= max_attempts
  )
);

create unique index if not exists os_notification_deliveries_key_idx
  on public.os_notification_deliveries(notification_key);

create index if not exists os_notification_deliveries_status_next_attempt_idx
  on public.os_notification_deliveries(status, next_attempt_at, created_at);

create index if not exists os_notification_deliveries_source_event_idx
  on public.os_notification_deliveries(source_event_id);

create index if not exists os_notification_deliveries_builder_submission_idx
  on public.os_notification_deliveries(builder_submission_id);

alter table public.os_notification_deliveries enable row level security;

revoke all on public.os_notification_deliveries from anon, authenticated;
grant all on public.os_notification_deliveries to service_role;

drop policy if exists "Service role manages notification deliveries" on public.os_notification_deliveries;
create policy "Service role manages notification deliveries"
  on public.os_notification_deliveries
  for all
  to service_role
  using (true)
  with check (true);
