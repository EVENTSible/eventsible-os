-- EVENTSible Ecosystem Integration Foundation
-- Additive only. Review and apply through the normal Supabase migration workflow.

create table if not exists public.os_integration_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload_version text not null,
  source_application text not null,
  occurred_at timestamptz not null default now(),
  related_record_ids jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  failure_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint os_integration_outbox_event_type_chk check (
    event_type in (
      'builder.submission_received',
      'lead.status_changed',
      'quote.ready',
      'quote.sent',
      'quote.accepted',
      'booking.confirmed',
      'event.updated',
      'event.room_requested',
      'event.completed',
      'client.portal_ready',
      'media.asset_added',
      'content.review_ready'
    )
  ),
  constraint os_integration_outbox_status_chk check (
    status in ('pending', 'processing', 'processed', 'retry', 'failed', 'dead_letter')
  )
);

create unique index if not exists os_integration_outbox_idempotency_key_idx
  on public.os_integration_outbox (idempotency_key);

create index if not exists os_integration_outbox_status_next_attempt_idx
  on public.os_integration_outbox (status, next_attempt_at, created_at);

alter table public.os_integration_outbox enable row level security;

revoke all on public.os_integration_outbox from anon, authenticated;
grant all on public.os_integration_outbox to service_role;

drop policy if exists "Service role manages integration outbox" on public.os_integration_outbox;
create policy "Service role manages integration outbox"
  on public.os_integration_outbox
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.os_enqueue_integration_event(
  _event_type text,
  _payload_version text,
  _source_application text,
  _related_record_ids jsonb,
  _payload jsonb,
  _idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.os_integration_outbox (
    event_type,
    payload_version,
    source_application,
    related_record_ids,
    payload,
    idempotency_key
  )
  values (
    _event_type,
    _payload_version,
    _source_application,
    coalesce(_related_record_ids, '{}'::jsonb),
    coalesce(_payload, '{}'::jsonb),
    _idempotency_key
  )
  on conflict (idempotency_key) do update
    set updated_at = public.os_integration_outbox.updated_at
  returning id into _id;

  return _id;
end;
$$;

revoke all on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) to service_role;
