create policy os_automation_outbox_staff_select
on public.os_automation_outbox
for select
to authenticated
using (public.os_is_staff());

grant select on public.os_automation_outbox to authenticated;