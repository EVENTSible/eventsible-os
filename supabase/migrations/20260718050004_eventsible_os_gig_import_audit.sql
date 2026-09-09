create table if not exists public.os_import_batches (
  id uuid primary key default gen_random_uuid(),
  import_type text not null default 'gig_csv' check (import_type in ('gig_csv','gig_json','manual_backfill')),
  file_name text,
  status text not null default 'importing' check (status in ('previewed','importing','completed','partial','failed','cancelled')),
  row_count integer not null default 0 check (row_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists os_import_batches_created_at_idx on public.os_import_batches(created_at desc);
create index if not exists os_import_batches_created_by_idx on public.os_import_batches(created_by) where created_by is not null;

create trigger os_import_batches_updated_at before update on public.os_import_batches for each row execute function public.os_set_updated_at();

alter table public.os_import_batches enable row level security;

create policy os_import_batches_staff_select on public.os_import_batches for select to authenticated using (public.os_is_staff());
create policy os_import_batches_staff_insert on public.os_import_batches for insert to authenticated with check (public.os_is_staff() and (created_by is null or created_by = (select auth.uid())));
create policy os_import_batches_staff_update on public.os_import_batches for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_import_batches_staff_delete on public.os_import_batches for delete to authenticated using (public.os_is_staff());

grant select, insert, update, delete on public.os_import_batches to authenticated;