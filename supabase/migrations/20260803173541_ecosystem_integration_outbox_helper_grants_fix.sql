-- EVENTSible OS outbox helper grant parity.
-- Mirrors the Production forward-fix applied after verification showed direct
-- anon/authenticated EXECUTE grants on the SECURITY DEFINER helper.
--
-- Scope: privileges on public.os_enqueue_integration_event only.
-- No table changes, data changes, CRM changes, intake wiring, or live emission.

revoke execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from anon;
revoke execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) to service_role;
