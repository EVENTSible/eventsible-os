create table public.os_files (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.os_events(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  category text not null default 'general',
  visibility text not null default 'shared' check (visibility in ('shared','client','staff_only','public')),
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  uploaded_by_contact_id uuid references public.os_contacts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket_id,object_path)
);

create index os_files_event_created_idx on public.os_files(event_id,created_at desc);
create index os_files_uploaded_by_user_idx on public.os_files(uploaded_by_user_id) where uploaded_by_user_id is not null;
create index os_files_uploaded_by_contact_idx on public.os_files(uploaded_by_contact_id) where uploaded_by_contact_id is not null;

create trigger os_files_updated_at before update on public.os_files for each row execute function public.os_set_updated_at();
alter table public.os_files enable row level security;

create policy os_files_select_access on public.os_files for select to authenticated using (
  public.os_has_event_access(event_id)
  and (visibility <> 'staff_only' or public.os_is_staff())
);
create policy os_files_insert_access on public.os_files for insert to authenticated with check (
  public.os_has_event_access(event_id)
  and (uploaded_by_user_id is null or uploaded_by_user_id=(select auth.uid()) or public.os_is_staff())
);
create policy os_files_update_access on public.os_files for update to authenticated
using (public.os_is_staff() or uploaded_by_user_id=(select auth.uid()))
with check (public.os_is_staff() or uploaded_by_user_id=(select auth.uid()));
create policy os_files_delete_access on public.os_files for delete to authenticated using (
  public.os_is_staff() or uploaded_by_user_id=(select auth.uid())
);

grant select,insert,update,delete on public.os_files to authenticated;

create or replace function public.os_storage_event_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = public,storage,pg_temp
as $$
declare
  first_folder text;
begin
  first_folder := (storage.foldername(object_name))[1];
  return first_folder::uuid;
exception when others then
  return null;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
('event-private','event-private',false,52428800,array[
  'image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg','audio/wav','audio/mp4','video/mp4','video/quicktime'
]),
('event-public','event-public',true,15728640,array[
  'image/jpeg','image/png','image/webp','image/gif','application/pdf'
])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy os_private_objects_select on storage.objects for select to authenticated using (
  bucket_id='event-private' and public.os_has_event_access(public.os_storage_event_id(name))
);
create policy os_private_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id='event-private' and public.os_has_event_access(public.os_storage_event_id(name))
);
create policy os_private_objects_update on storage.objects for update to authenticated
using (
  bucket_id='event-private'
  and public.os_has_event_access(public.os_storage_event_id(name))
  and (public.os_is_staff() or owner_id=(select auth.uid())::text)
)
with check (
  bucket_id='event-private'
  and public.os_has_event_access(public.os_storage_event_id(name))
  and (public.os_is_staff() or owner_id=(select auth.uid())::text)
);
create policy os_private_objects_delete on storage.objects for delete to authenticated using (
  bucket_id='event-private'
  and public.os_has_event_access(public.os_storage_event_id(name))
  and (public.os_is_staff() or owner_id=(select auth.uid())::text)
);

create policy os_public_objects_read on storage.objects for select to anon,authenticated using (bucket_id='event-public');
create policy os_public_objects_staff_insert on storage.objects for insert to authenticated with check (
  bucket_id='event-public' and public.os_is_staff()
);
create policy os_public_objects_staff_update on storage.objects for update to authenticated
using (bucket_id='event-public' and public.os_is_staff())
with check (bucket_id='event-public' and public.os_is_staff());
create policy os_public_objects_staff_delete on storage.objects for delete to authenticated using (
  bucket_id='event-public' and public.os_is_staff()
);