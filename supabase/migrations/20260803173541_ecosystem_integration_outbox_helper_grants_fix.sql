-- EVENTSible OS outbox helper grant parity.
-- Mirrors the Production forward-fix applied after verification showed direct
-- anon/authenticated EXECUTE grants on the SECURITY DEFINER helper.
--
-- Scope: privileges on public.os_enqueue_integration_event only.
-- No table changes, data changes, CRM changes, intake wiring, or live emission.

-- Fail with a precise migration-order error if the foundation helper has not
-- been created before this grant-fix migration runs.
do $$
begin
  if to_regprocedure('public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text)') is null then
    raise exception 'Expected helper signature public.os_enqueue_integration_event(text,text,text,jsonb,jsonb,text) is missing before grant parity migration.';
  end if;
end $$;

revoke execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from anon;
revoke execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) to service_role;
