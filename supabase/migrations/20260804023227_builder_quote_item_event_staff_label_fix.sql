-- EVENTSible Builder quote-item display label forward fix.
--
-- Production incident context:
-- - Builder intake-to-outbox wiring is working, but the Production QA quote item
--   for stable service code event_staff stored a machine label as service_name.
-- - This migration does not alter Builder intake, outbox helpers, activity triggers,
--   CRM/event/quote schemas, or existing data.
-- - It only normalizes future event_staff quote-item display names at insert time.

create or replace function public.os_normalize_builder_quote_item_service_name()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.service_code = 'event_staff'
     and lower(btrim(coalesce(new.service_name, ''))) in ('', 'event_staff', 'event-asst', 'event_asst') then
    new.service_name := 'Event Staff';
  end if;

  return new;
end;
$$;

revoke all on function public.os_normalize_builder_quote_item_service_name() from public;
revoke execute on function public.os_normalize_builder_quote_item_service_name() from anon;
revoke execute on function public.os_normalize_builder_quote_item_service_name() from authenticated;
grant execute on function public.os_normalize_builder_quote_item_service_name() to service_role;

drop trigger if exists os_quote_items_builder_service_name_trg on public.os_quote_items;

create trigger os_quote_items_builder_service_name_trg
before insert on public.os_quote_items
for each row
when (new.service_code = 'event_staff')
execute function public.os_normalize_builder_quote_item_service_name();
