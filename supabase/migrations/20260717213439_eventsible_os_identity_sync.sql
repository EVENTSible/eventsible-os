create table public.os_owner_bootstrap_state (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  desired_role text not null default 'owner' check (desired_role in ('owner','manager','staff','host')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  invited_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.os_owner_bootstrap_state enable row level security;

create policy os_owner_bootstrap_staff_read
on public.os_owner_bootstrap_state
for select to authenticated
using (public.os_is_staff());

grant select on public.os_owner_bootstrap_state to authenticated;

create trigger os_owner_bootstrap_updated_at
before update on public.os_owner_bootstrap_state
for each row execute function public.os_set_updated_at();

create or replace function private.os_sync_auth_user_identity()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  matched_contact_id uuid;
  display_label text;
begin
  display_label := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name',''),
    nullif(new.raw_user_meta_data ->> 'full_name',''),
    split_part(coalesce(new.email,''),'@',1)
  );

  insert into public.os_profiles(id,display_name,email,phone,is_active,updated_at)
  values(new.id,display_label,new.email,new.phone,true,now())
  on conflict(id) do update set
    display_name = coalesce(excluded.display_name,public.os_profiles.display_name),
    email = excluded.email,
    phone = excluded.phone,
    is_active = true,
    updated_at = now();

  if new.email is not null then
    select c.id into matched_contact_id
    from public.os_contacts c
    where lower(c.primary_email)=lower(new.email)
      and c.status='active'
    order by c.created_at
    limit 1;
  end if;

  if matched_contact_id is not null then
    insert into public.os_contact_users(contact_id,user_id,relationship,is_primary)
    values(matched_contact_id,new.id,'self',true)
    on conflict(contact_id,user_id) do update set
      relationship='self',
      is_primary=true;

    update public.os_event_members em
    set user_id=new.id,
        accepted_at=coalesce(em.accepted_at,now()),
        is_active=true,
        updated_at=now()
    where em.contact_id=matched_contact_id
      and em.user_id is null
      and not exists (
        select 1
        from public.os_event_members existing
        where existing.event_id=em.event_id
          and existing.user_id=new.id
          and existing.is_active
      );
  end if;

  return new;
end;
$$;

revoke all on function private.os_sync_auth_user_identity() from public,anon,authenticated;

drop trigger if exists os_auth_user_identity_sync on auth.users;
create trigger os_auth_user_identity_sync
after insert or update of email,phone,raw_user_meta_data
on auth.users
for each row execute function private.os_sync_auth_user_identity();