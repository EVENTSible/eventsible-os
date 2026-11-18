-- Disposable database verification only. Production rollback needs separate approval.
begin;
do $guard$
begin
  if exists(select 1 from public.os_leads where source='gigsalad' and metadata ? 'gigsalad_thread_url')
     or exists(select 1 from public.os_activity_events where event_type='opportunity.intake_created'
       or event_type like 'lead.follow_up.%')
     or exists(select 1 from public.os_files where bucket_id='opportunity-evidence')
     or exists(select 1 from storage.objects where bucket_id='opportunity-evidence') then
    raise exception 'Opportunity Desk rollback blocked: records or evidence still exist';
  end if;
end;
$guard$;
revoke all on function public.os_follow_up_operation(text,uuid,uuid,jsonb) from authenticated;
revoke all on function public.os_create_opportunity(uuid,jsonb) from authenticated;
drop function public.os_follow_up_operation(text,uuid,uuid,jsonb);
drop function public.os_create_opportunity(uuid,jsonb);
drop index public.os_leads_gigsalad_thread_unique;
drop policy os_opportunity_evidence_staff_read on storage.objects;
drop policy os_opportunity_evidence_owner_write on storage.objects;
drop policy os_opportunity_evidence_owner_cleanup on storage.objects;
drop policy os_files_opportunity_evidence_owner_insert on public.os_files;
-- Supabase protects bucket deletion at the database layer. Leave the empty,
-- private bucket in place; a separately approved Storage API call may remove it.
commit;
