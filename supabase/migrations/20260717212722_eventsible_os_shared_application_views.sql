create or replace view public.os_event_dashboard_v
with (security_invoker = true)
as
select
  e.id as event_id,
  e.title,
  e.event_type,
  e.status as event_status,
  e.starts_at,
  e.ends_at,
  e.timezone,
  e.venue_name,
  concat_ws(', ', nullif(e.venue_address_1,''), nullif(e.venue_city,''), nullif(e.venue_state,''), nullif(e.venue_postal_code,'')) as venue_summary,
  e.guest_count,
  e.public_slug,
  e.source,
  e.updated_at as event_updated_at,
  c.id as primary_contact_id,
  coalesce(c.display_name, nullif(concat_ws(' ',c.first_name,c.last_name),''), c.organization_name) as primary_contact_name,
  c.organization_name,
  c.primary_email,
  c.primary_phone,
  l.id as lead_id,
  l.status as lead_status,
  l.next_follow_up_at,
  q.id as latest_quote_id,
  q.version_number as latest_quote_version,
  q.status as latest_quote_status,
  q.total_amount as quote_total,
  q.deposit_amount as quote_deposit,
  b.id as booking_id,
  b.status as booking_status,
  b.contract_status,
  b.payment_status,
  b.total_amount as booked_total,
  b.deposit_amount as booked_deposit,
  b.balance_due,
  b.balance_due_at,
  p.assignment_id,
  p.template_slug as planning_template,
  p.template_name as planning_template_name,
  p.planning_status,
  p.progress_percent,
  p.first_opened_at,
  p.last_opened_at,
  p.last_saved_at,
  p.submitted_at,
  coalesce(s.services,'[]'::jsonb) as booked_services,
  a.last_activity_type,
  a.last_activity_at
from public.os_events e
left join public.os_contacts c on c.id=e.primary_contact_id
left join lateral (
  select lead.* from public.os_leads lead
  where lead.event_id=e.id order by lead.updated_at desc limit 1
) l on true
left join lateral (
  select quote.* from public.os_quote_versions quote
  where quote.event_id=e.id order by quote.version_number desc limit 1
) q on true
left join public.os_bookings b on b.event_id=e.id
left join lateral (
  select pa.id as assignment_id,pt.slug as template_slug,pt.name as template_name,
         pa.status as planning_status,pa.progress_percent,pa.first_opened_at,
         pa.last_opened_at,pa.last_saved_at,pa.submitted_at
  from public.os_planning_assignments pa
  join public.os_planning_templates pt on pt.id=pa.template_id
  where pa.event_id=e.id order by pa.updated_at desc limit 1
) p on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id',bs.id,'code',bs.service_code,'name',bs.service_name,'status',bs.status,
      'starts_at',bs.starts_at,'ends_at',bs.ends_at,'location',bs.location_label,
      'configuration',bs.configuration
    ) order by bs.created_at
  ) as services
  from public.os_booking_services bs
  where b.id is not null and bs.booking_id=b.id and bs.status <> 'cancelled'
) s on true
left join lateral (
  select ae.event_type as last_activity_type,ae.occurred_at as last_activity_at
  from public.os_activity_events ae
  where ae.event_id=e.id order by ae.occurred_at desc limit 1
) a on true;

create or replace view public.os_planning_form_v
with (security_invoker = true)
as
select
  pa.id as assignment_id,
  pa.event_id,
  pa.status as assignment_status,
  pa.progress_percent,
  pa.current_section_key,
  pa.first_opened_at,
  pa.last_opened_at,
  pa.last_saved_at,
  pa.submitted_at,
  pt.slug as template_slug,
  pt.name as template_name,
  pt.version as template_version,
  pt.settings as template_settings,
  ps.id as section_id,
  ps.section_key,
  ps.title as section_title,
  ps.description as section_description,
  ps.sort_order as section_sort_order,
  ps.condition as section_condition,
  pq.id as question_id,
  pq.question_key,
  pq.label,
  pq.help_text,
  pq.field_type,
  pq.is_required,
  pq.sort_order as question_sort_order,
  pq.options,
  pq.condition as question_condition,
  pq.validation,
  pq.writeback_fact_key,
  pq.prefill_sources,
  pan.id as answer_id,
  pan.value as answer_value,
  pan.source as answer_source,
  pan.is_confirmed as answer_confirmed,
  pan.updated_at as answer_updated_at
from public.os_planning_assignments pa
join public.os_planning_templates pt on pt.id=pa.template_id
join public.os_planning_sections ps on ps.template_id=pt.id
join public.os_planning_questions pq on pq.section_id=ps.id
left join public.os_planning_answers pan
  on pan.assignment_id=pa.id and pan.question_key=pq.question_key;

create or replace view public.os_event_message_feed_v
with (security_invoker = true)
as
select
  mt.event_id,
  mt.id as thread_id,
  mt.subject,
  mt.thread_type,
  mt.status as thread_status,
  m.id as message_id,
  m.sender_user_id,
  m.sender_contact_id,
  m.visibility,
  m.body,
  m.attachments,
  m.sent_at,
  m.edited_at
from public.os_message_threads mt
left join public.os_messages m on m.thread_id=mt.id;

grant select on public.os_event_dashboard_v,public.os_planning_form_v,public.os_event_message_feed_v to authenticated;