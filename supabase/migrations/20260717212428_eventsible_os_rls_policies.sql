alter table public.os_profiles enable row level security;
alter table public.os_contacts enable row level security;
alter table public.os_contact_users enable row level security;
alter table public.os_service_catalog enable row level security;
alter table public.os_builder_submissions enable row level security;
alter table public.os_events enable row level security;
alter table public.os_event_members enable row level security;
alter table public.os_event_facts enable row level security;
alter table public.os_leads enable row level security;
alter table public.os_quote_versions enable row level security;
alter table public.os_quote_items enable row level security;
alter table public.os_bookings enable row level security;
alter table public.os_booking_services enable row level security;
alter table public.os_planning_templates enable row level security;
alter table public.os_planning_sections enable row level security;
alter table public.os_planning_questions enable row level security;
alter table public.os_planning_assignments enable row level security;
alter table public.os_planning_answers enable row level security;
alter table public.os_message_threads enable row level security;
alter table public.os_messages enable row level security;
alter table public.os_activity_events enable row level security;
alter table public.os_automation_outbox enable row level security;

create policy os_profiles_select_self_or_staff on public.os_profiles for select to authenticated using (id = (select auth.uid()) or public.os_is_staff());
create policy os_profiles_insert_self on public.os_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy os_profiles_update_self_or_staff on public.os_profiles for update to authenticated using (id = (select auth.uid()) or public.os_is_staff()) with check (id = (select auth.uid()) or public.os_is_staff());

create policy os_contacts_select_access on public.os_contacts for select to authenticated using (public.os_has_contact_access(id));
create policy os_contacts_staff_insert on public.os_contacts for insert to authenticated with check (public.os_is_staff());
create policy os_contacts_staff_update on public.os_contacts for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_contacts_staff_delete on public.os_contacts for delete to authenticated using (public.os_is_staff());

create policy os_contact_users_select_own_or_staff on public.os_contact_users for select to authenticated using (user_id = (select auth.uid()) or public.os_is_staff());
create policy os_contact_users_staff_insert on public.os_contact_users for insert to authenticated with check (public.os_is_staff());
create policy os_contact_users_staff_update on public.os_contact_users for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_contact_users_staff_delete on public.os_contact_users for delete to authenticated using (public.os_is_staff());

create policy os_service_catalog_public_read on public.os_service_catalog for select to anon, authenticated using (is_active or public.os_is_staff());
create policy os_service_catalog_staff_insert on public.os_service_catalog for insert to authenticated with check (public.os_is_staff());
create policy os_service_catalog_staff_update on public.os_service_catalog for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_service_catalog_staff_delete on public.os_service_catalog for delete to authenticated using (public.os_is_staff());

create policy os_builder_submissions_staff_read on public.os_builder_submissions for select to authenticated using (public.os_is_staff());
create policy os_builder_submissions_staff_insert on public.os_builder_submissions for insert to authenticated with check (public.os_is_staff());
create policy os_builder_submissions_staff_update on public.os_builder_submissions for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_builder_submissions_staff_delete on public.os_builder_submissions for delete to authenticated using (public.os_is_staff());

create policy os_events_select_access on public.os_events for select to authenticated using (public.os_has_event_access(id));
create policy os_events_staff_insert on public.os_events for insert to authenticated with check (public.os_is_staff());
create policy os_events_staff_update on public.os_events for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_events_staff_delete on public.os_events for delete to authenticated using (public.os_is_staff());

create policy os_event_members_select_own_or_staff on public.os_event_members for select to authenticated using (user_id = (select auth.uid()) or public.os_is_staff());
create policy os_event_members_staff_insert on public.os_event_members for insert to authenticated with check (public.os_is_staff());
create policy os_event_members_staff_update on public.os_event_members for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_event_members_staff_delete on public.os_event_members for delete to authenticated using (public.os_is_staff());

create policy os_event_facts_select_access on public.os_event_facts for select to authenticated using (public.os_has_event_access(event_id));
create policy os_event_facts_staff_insert on public.os_event_facts for insert to authenticated with check (public.os_is_staff());
create policy os_event_facts_staff_update on public.os_event_facts for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_event_facts_staff_delete on public.os_event_facts for delete to authenticated using (public.os_is_staff());

create policy os_leads_staff_all on public.os_leads for all to authenticated using (public.os_is_staff()) with check (public.os_is_staff());

create policy os_quote_versions_select_access on public.os_quote_versions for select to authenticated using (public.os_is_staff() or (status <> 'draft' and public.os_has_event_access(event_id)));
create policy os_quote_versions_staff_insert on public.os_quote_versions for insert to authenticated with check (public.os_is_staff());
create policy os_quote_versions_staff_update on public.os_quote_versions for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_quote_versions_staff_delete on public.os_quote_versions for delete to authenticated using (public.os_is_staff());

create policy os_quote_items_select_access on public.os_quote_items for select to authenticated using (
  exists (
    select 1 from public.os_quote_versions qv
    where qv.id = quote_version_id
      and (public.os_is_staff() or (qv.status <> 'draft' and public.os_has_event_access(qv.event_id)))
  )
);
create policy os_quote_items_staff_insert on public.os_quote_items for insert to authenticated with check (public.os_is_staff());
create policy os_quote_items_staff_update on public.os_quote_items for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_quote_items_staff_delete on public.os_quote_items for delete to authenticated using (public.os_is_staff());

create policy os_bookings_select_access on public.os_bookings for select to authenticated using (public.os_has_event_access(event_id));
create policy os_bookings_staff_insert on public.os_bookings for insert to authenticated with check (public.os_is_staff());
create policy os_bookings_staff_update on public.os_bookings for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_bookings_staff_delete on public.os_bookings for delete to authenticated using (public.os_is_staff());

create policy os_booking_services_select_access on public.os_booking_services for select to authenticated using (
  exists (select 1 from public.os_bookings b where b.id = booking_id and public.os_has_event_access(b.event_id))
);
create policy os_booking_services_staff_insert on public.os_booking_services for insert to authenticated with check (public.os_is_staff());
create policy os_booking_services_staff_update on public.os_booking_services for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_booking_services_staff_delete on public.os_booking_services for delete to authenticated using (public.os_is_staff());

create policy os_planning_templates_public_read on public.os_planning_templates for select to anon, authenticated using (status = 'published' or public.os_is_staff());
create policy os_planning_templates_staff_insert on public.os_planning_templates for insert to authenticated with check (public.os_is_staff());
create policy os_planning_templates_staff_update on public.os_planning_templates for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_planning_templates_staff_delete on public.os_planning_templates for delete to authenticated using (public.os_is_staff());

create policy os_planning_sections_public_read on public.os_planning_sections for select to anon, authenticated using (
  exists (select 1 from public.os_planning_templates pt where pt.id = template_id and (pt.status = 'published' or public.os_is_staff()))
);
create policy os_planning_sections_staff_insert on public.os_planning_sections for insert to authenticated with check (public.os_is_staff());
create policy os_planning_sections_staff_update on public.os_planning_sections for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_planning_sections_staff_delete on public.os_planning_sections for delete to authenticated using (public.os_is_staff());

create policy os_planning_questions_public_read on public.os_planning_questions for select to anon, authenticated using (
  exists (
    select 1
    from public.os_planning_sections ps
    join public.os_planning_templates pt on pt.id = ps.template_id
    where ps.id = section_id and (pt.status = 'published' or public.os_is_staff())
  )
);
create policy os_planning_questions_staff_insert on public.os_planning_questions for insert to authenticated with check (public.os_is_staff());
create policy os_planning_questions_staff_update on public.os_planning_questions for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_planning_questions_staff_delete on public.os_planning_questions for delete to authenticated using (public.os_is_staff());

create policy os_planning_assignments_select_access on public.os_planning_assignments for select to authenticated using (public.os_has_event_access(event_id));
create policy os_planning_assignments_staff_insert on public.os_planning_assignments for insert to authenticated with check (public.os_is_staff());
create policy os_planning_assignments_staff_update on public.os_planning_assignments for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());
create policy os_planning_assignments_staff_delete on public.os_planning_assignments for delete to authenticated using (public.os_is_staff());

create policy os_planning_answers_select_access on public.os_planning_answers for select to authenticated using (public.os_has_assignment_access(assignment_id));
create policy os_planning_answers_insert_access on public.os_planning_answers for insert to authenticated with check (
  public.os_has_assignment_access(assignment_id)
  and (updated_by is null or updated_by = (select auth.uid()) or public.os_is_staff())
);
create policy os_planning_answers_update_access on public.os_planning_answers for update to authenticated using (public.os_has_assignment_access(assignment_id)) with check (
  public.os_has_assignment_access(assignment_id)
  and (updated_by is null or updated_by = (select auth.uid()) or public.os_is_staff())
);

create policy os_message_threads_select_access on public.os_message_threads for select to authenticated using (public.os_has_event_access(event_id));
create policy os_message_threads_insert_access on public.os_message_threads for insert to authenticated with check (
  public.os_has_event_access(event_id) and (created_by is null or created_by = (select auth.uid()) or public.os_is_staff())
);
create policy os_message_threads_staff_update on public.os_message_threads for update to authenticated using (public.os_is_staff()) with check (public.os_is_staff());

create policy os_messages_select_access on public.os_messages for select to authenticated using (
  exists (
    select 1 from public.os_message_threads mt
    where mt.id = thread_id
      and public.os_has_event_access(mt.event_id)
      and (visibility <> 'staff_only' or public.os_is_staff())
  )
);
create policy os_messages_insert_access on public.os_messages for insert to authenticated with check (
  sender_user_id = (select auth.uid())
  and exists (select 1 from public.os_message_threads mt where mt.id = thread_id and public.os_has_event_access(mt.event_id))
  and (visibility <> 'staff_only' or public.os_is_staff())
);

create policy os_activity_events_select_access on public.os_activity_events for select to authenticated using (
  public.os_is_staff() or (event_id is not null and visibility in ('client','shared') and public.os_has_event_access(event_id))
);

grant select, insert, update on public.os_profiles to authenticated;
grant select, insert, update, delete on public.os_contacts, public.os_contact_users, public.os_service_catalog, public.os_builder_submissions, public.os_events, public.os_event_members, public.os_event_facts, public.os_leads, public.os_quote_versions, public.os_quote_items, public.os_bookings, public.os_booking_services, public.os_planning_templates, public.os_planning_sections, public.os_planning_questions, public.os_planning_assignments, public.os_planning_answers, public.os_message_threads, public.os_messages to authenticated;
grant select on public.os_activity_events to authenticated;
grant select on public.os_service_catalog, public.os_planning_templates, public.os_planning_sections, public.os_planning_questions to anon;