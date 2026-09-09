-- EVENTSible Builder quote-item Event Staff code parity forward fix.
--
-- Production incident context:
-- - The prior display-label trigger normalized only future quote items whose
--   service_code was event_staff.
-- - Production QA showed the live Builder intake can store Event Staff as
--   service_code event-asst with service_name event-asst.
-- - This migration does not alter Builder intake, outbox helpers, activity
--   triggers, CRM/event/quote schemas, or existing data.
-- - It only broadens future Event Staff quote-item display-name normalization.

create or replace function public.os_normalize_builder_quote_item_service_name()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if lower(btrim(coalesce(new.service_code, ''))) in ('event_staff', 'event-asst', 'event_asst')
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
when (new.service_code in ('event_staff', 'event-asst', 'event_asst'))
execute function public.os_normalize_builder_quote_item_service_name();
