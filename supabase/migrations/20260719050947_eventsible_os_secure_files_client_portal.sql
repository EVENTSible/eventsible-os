drop policy if exists os_private_objects_select on storage.objects;
create policy os_private_objects_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'event-private'
  and public.os_has_event_access(public.os_storage_event_id(name))
  and (
    public.os_is_staff()
    or exists (
      select 1
      from public.os_files f
      where f.bucket_id = storage.objects.bucket_id
        and f.object_path = storage.objects.name
        and f.event_id = public.os_storage_event_id(storage.objects.name)
        and f.visibility in ('shared','client','public')
    )
  )
);

drop policy if exists os_private_objects_insert on storage.objects;
create policy os_private_objects_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-private'
  and public.os_has_event_access(public.os_storage_event_id(name))
  and (
    public.os_is_staff()
    or (storage.foldername(name))[2] in ('shared','client')
  )
);

drop policy if exists os_files_insert_access on public.os_files;
create policy os_files_insert_access
on public.os_files for insert
to authenticated
with check (
  public.os_has_event_access(event_id)
  and public.os_storage_event_id(object_path) = event_id
  and (
    uploaded_by_user_id is null
    or uploaded_by_user_id = (select auth.uid())
    or public.os_is_staff()
  )
  and (
    public.os_is_staff()
    or (
      bucket_id = 'event-private'
      and visibility in ('shared','client')
    )
  )
);

drop policy if exists os_files_update_access on public.os_files;
create policy os_files_update_access
on public.os_files for update
to authenticated
using (
  public.os_is_staff()
  or (
    uploaded_by_user_id = (select auth.uid())
    and public.os_has_event_access(event_id)
  )
)
with check (
  public.os_storage_event_id(object_path) = event_id
  and (
    public.os_is_staff()
    or (
      uploaded_by_user_id = (select auth.uid())
      and public.os_has_event_access(event_id)
      and bucket_id = 'event-private'
      and visibility in ('shared','client')
    )
  )
);

drop policy if exists os_files_delete_access on public.os_files;
create policy os_files_delete_access
on public.os_files for delete
to authenticated
using (
  public.os_is_staff()
  or (
    uploaded_by_user_id = (select auth.uid())
    and public.os_has_event_access(event_id)
  )
);

create or replace view public.os_client_portal_v
with (security_invoker = true)
as
select
  d.event_id,
  d.title,
  d.event_type,
  d.event_status,
  d.starts_at,
  d.ends_at,
  d.timezone,
  d.venue_name,
  d.venue_summary,
  d.guest_count,
  d.primary_contact_name,
  d.booking_status,
  d.contract_status,
  d.payment_status,
  d.booked_total,
  d.booked_deposit,
  d.balance_due,
  d.balance_due_at,
  d.planning_template,
  d.planning_template_name,
  d.planning_status,
  d.progress_percent,
  d.submitted_at,
  d.booked_services,
  coalesce(f.file_count, 0) as file_count,
  coalesce(m.message_count, 0) as message_count,
  m.thread_id as client_thread_id
from public.os_event_dashboard_v d
left join lateral (
  select count(*)::integer as file_count
  from public.os_files f
  where f.event_id = d.event_id
    and f.visibility <> 'staff_only'
) f on true
left join lateral (
  select
    mt.id as thread_id,
    count(msg.id)::integer as message_count
  from public.os_message_threads mt
  left join public.os_messages msg on msg.thread_id = mt.id
  where mt.event_id = d.event_id
    and mt.thread_type = 'client'
  group by mt.id
  order by mt.updated_at desc
  limit 1
) m on true;

grant select on public.os_client_portal_v to authenticated;
grant select, insert, update, delete on public.os_files to authenticated;
