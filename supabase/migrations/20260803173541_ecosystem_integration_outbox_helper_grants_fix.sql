revoke all on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) from anon, authenticated;
grant execute on function public.os_enqueue_integration_event(text, text, text, jsonb, jsonb, text) to service_role;
