insert into public.os_planning_questions(section_id,question_key,label,help_text,field_type,is_required,sort_order,options,condition,writeback_fact_key,prefill_sources)
select ps.id,q.question_key,q.label,q.help_text,q.field_type,q.is_required,q.sort_order,q.options,q.condition,q.writeback_fact_key,q.prefill_sources
from public.os_planning_sections ps
join public.os_planning_templates pt on pt.id=ps.template_id and pt.slug='wedding-hero' and pt.version=1
join (values
  ('event_basics','event_date_confirmed','Is the wedding date correct?',null,'yes_no',true,10,'[]'::jsonb,'{}'::jsonb,'event.date_confirmed','["builder.event_date","event.starts_at"]'::jsonb),
  ('event_basics','guest_count','Estimated guest count',null,'number',false,20,'[]'::jsonb,'{}'::jsonb,'event.guest_count','["builder.guest_count","event.guest_count"]'::jsonb),
  ('ceremony','ceremony_included','Will EVENTSible provide ceremony sound or music?',null,'yes_no',false,10,'[]'::jsonb,'{}'::jsonb,'ceremony.included','["builder.ceremony_needed","booking.services"]'::jsonb),
  ('ceremony','ceremony_location','Where will the ceremony take place?',null,'long_text',false,20,'[]'::jsonb,'{"answer":"ceremony_included","equals":true}'::jsonb,'ceremony.location','["builder.ceremony_location"]'::jsonb),
  ('ceremony','officiant_needs_mic','Will the officiant need a microphone?',null,'yes_no',false,30,'[]'::jsonb,'{"answer":"ceremony_included","equals":true}'::jsonb,'ceremony.officiant_needs_mic','[]'::jsonb),
  ('reception','wedding_party_introductions','Would you like formal wedding-party introductions?',null,'yes_no',false,10,'[]'::jsonb,'{}'::jsonb,'reception.introductions','[]'::jsonb),
  ('reception','first_dance_song','First dance song',null,'song',false,20,'[]'::jsonb,'{}'::jsonb,'music.first_dance','[]'::jsonb),
  ('music','must_play_list','Must-play songs or artists',null,'repeater',false,10,'[]'::jsonb,'{}'::jsonb,'music.must_play','["builder.music_preferences"]'::jsonb),
  ('music','do_not_play_list','Do-not-play songs or artists',null,'repeater',false,20,'[]'::jsonb,'{}'::jsonb,'music.do_not_play','[]'::jsonb),
  ('logistics','venue_access_time','What time can our team access the venue?',null,'time',false,10,'[]'::jsonb,'{}'::jsonb,'venue.access_time','["builder.venue_access_time"]'::jsonb),
  ('logistics','power_available','Is reliable power available near each setup area?',null,'yes_no',false,20,'[]'::jsonb,'{}'::jsonb,'venue.power_available','["builder.power_available"]'::jsonb),
  ('logistics','wifi_available','Is venue Wi-Fi available if needed?',null,'yes_no',false,30,'[]'::jsonb,'{}'::jsonb,'venue.wifi_available','["builder.wifi_available"]'::jsonb),
  ('logistics','weather_backup_plan','What is the weather backup plan for outdoor portions?',null,'long_text',false,40,'[]'::jsonb,'{"fact":"venue.outdoor","equals":true}'::jsonb,'venue.weather_backup_plan','[]'::jsonb)
) as q(section_key,question_key,label,help_text,field_type,is_required,sort_order,options,condition,writeback_fact_key,prefill_sources)
  on q.section_key=ps.section_key
on conflict(section_id,question_key) do update set
  label=excluded.label,
  help_text=excluded.help_text,
  field_type=excluded.field_type,
  is_required=excluded.is_required,
  sort_order=excluded.sort_order,
  options=excluded.options,
  condition=excluded.condition,
  writeback_fact_key=excluded.writeback_fact_key,
  prefill_sources=excluded.prefill_sources;