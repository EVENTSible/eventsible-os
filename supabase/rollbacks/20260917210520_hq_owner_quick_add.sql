begin;

do $$
begin
  if exists (select 1 from public.os_bookings where payment_status='unknown') then
    raise exception 'Owner Quick Add rollback blocked: bookings with unknown payment status still exist'
      using errcode='23514',
      hint='Resolve every unknown status from evidence to an allowed known status before retrying rollback. Do not coerce unknown rows automatically.';
  end if;
end;
$$;

revoke all on function public.os_owner_quick_add(uuid,text,jsonb,boolean) from public, anon, authenticated, service_role;
drop function public.os_owner_quick_add(uuid,text,jsonb,boolean);

alter table public.os_bookings drop constraint os_bookings_payment_status_check;
alter table public.os_bookings add constraint os_bookings_payment_status_check
  check (payment_status in ('unpaid','deposit_due','deposit_paid','partially_paid','paid','refunded'));

-- Quick Add reuses the shared os_activity_events idempotency ledger. Preserve
-- those immutable audit rows and its shared unique index during feature rollback.

commit;
