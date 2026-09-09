create or replace function private.os_create_pending_booking_from_quote()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_booking_id uuid;
begin
  if new.status <> 'accepted' or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  insert into public.os_bookings(
    event_id,accepted_quote_version_id,status,contract_status,payment_status,
    total_amount,deposit_amount,balance_due,metadata
  )
  values(
    new.event_id,new.id,'pending_contract','not_sent',
    case when coalesce(new.deposit_amount,0) > 0 then 'deposit_due' else 'unpaid' end,
    new.total_amount,new.deposit_amount,
    greatest(coalesce(new.total_amount,0) - coalesce(new.deposit_amount,0),0),
    jsonb_build_object('auto_created_from_quote',true,'quote_version_number',new.version_number)
  )
  on conflict(event_id)
  do update set
    accepted_quote_version_id = excluded.accepted_quote_version_id,
    status = case
      when public.os_bookings.status in ('confirmed','completed','cancelled') then public.os_bookings.status
      else 'pending_contract'
    end,
    total_amount = excluded.total_amount,
    deposit_amount = excluded.deposit_amount,
    balance_due = excluded.balance_due,
    payment_status = case
      when public.os_bookings.payment_status in ('deposit_paid','partially_paid','paid') then public.os_bookings.payment_status
      else excluded.payment_status
    end,
    metadata = public.os_bookings.metadata || excluded.metadata,
    updated_at = now()
  returning id into target_booking_id;

  update public.os_events
  set status = case
      when status in ('booked','planning','ready','active','completed','cancelled','archived') then status
      else 'pending'
    end,
    updated_at = now()
  where id = new.event_id;

  update public.os_leads
  set status = 'won', updated_at = now()
  where id = new.lead_id and status not in ('won','archived');

  perform private.os_emit_event(
    new.event_id,
    'booking.started',
    jsonb_build_object(
      'booking_id',target_booking_id,
      'quote_version_id',new.id,
      'total_amount',new.total_amount,
      'deposit_amount',new.deposit_amount
    ),
    'quote:' || new.id::text || ':booking-started',
    'shared'
  );

  perform private.os_emit_event(
    new.event_id,
    'contract.requested',
    jsonb_build_object('booking_id',target_booking_id,'quote_version_id',new.id),
    'booking:' || target_booking_id::text || ':contract-requested',
    'system'
  );

  if coalesce(new.deposit_amount,0) > 0 then
    perform private.os_emit_event(
      new.event_id,
      'deposit.requested',
      jsonb_build_object('booking_id',target_booking_id,'amount',new.deposit_amount,'currency',new.currency),
      'booking:' || target_booking_id::text || ':deposit-requested',
      'system'
    );
  end if;

  return new;
end;
$$;
revoke all on function private.os_create_pending_booking_from_quote() from public, anon, authenticated;

create or replace function private.os_reconcile_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status in ('cancelled','completed') then
    return new;
  end if;

  if new.contract_status = 'signed' and new.payment_status in ('deposit_paid','partially_paid','paid') then
    new.status := 'confirmed';
    new.booked_at := coalesce(new.booked_at,now());
  elsif new.contract_status = 'signed' then
    new.status := 'pending_deposit';
  elsif new.payment_status in ('deposit_paid','partially_paid','paid') then
    new.status := 'pending_contract';
  elsif new.contract_status in ('sent','viewed') then
    new.status := 'pending_contract';
  end if;

  return new;
end;
$$;
revoke all on function private.os_reconcile_booking_status() from public, anon, authenticated;

create trigger os_quote_create_pending_booking
after insert or update on public.os_quote_versions
for each row execute function private.os_create_pending_booking_from_quote();

create trigger os_booking_reconcile_status
before insert or update of contract_status,payment_status,status on public.os_bookings
for each row execute function private.os_reconcile_booking_status();