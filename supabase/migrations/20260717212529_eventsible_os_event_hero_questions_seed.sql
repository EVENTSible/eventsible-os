insert into public.os_planning_questions(section_id,question_key,label,help_text,field_type,is_required,sort_order,options,condition,writeback_fact_key,prefill_sources)
select ps.id,q.question_key,q.label,q.help_text,q.field_type,q.is_required,q.sort_order,q.options,q.condition,q.writeback_fact_key,q.prefill_sources
from public.os_planning_sections ps
join public.os_planning_templates pt on pt.id=ps.template_id and pt.slug='event-hero' and pt.version=1
join (values
  ('event_basics','guest_count','Estimated guest count',null,'number',false,10,'[]'::jsonb,'{}'::jsonb,'event.guest_count','["builder.guest_count","event.guest_count"]'::jsonb),
  ('experience','event_goal','What should this event accomplish or feel like?',null,'long_text',true,10,'[]'::jsonb,'{}'::jsonb,'experience.goal','["builder.what_matters_most"]'::jsonb),
  ('experience','guest_age_range','What age groups will attend?',null,'multi_select',false,20,'["Children","Teens","Adults","Seniors","Mixed ages"]'::jsonb,'{}'::jsonb,'experience.age_range','["builder.age_range"]'::jsonb),
  ('experience','event_theme','Theme, colors or creative direction',null,'long_text',false,30,'[]'::jsonb,'{}'::jsonb,'experience.theme','["builder.theme"]'::jsonb),
  ('entertainment','clean_music_required','Is clean or radio-edit music required?',null,'yes_no',false,10,'[]'::jsonb,'{}'::jsonb,'music.clean_required','["builder.clean_music_required"]'::jsonb),
  ('entertainment','announcements','Important announcements or acknowledgments',null,'repeater',false,20,'[]'::jsonb,'{}'::jsonb,'program.announcements','[]'::jsonb),
  ('entertainment','interactive_activities','Which interactive activities interest you?',null,'multi_select',false,30,'["Karaoke","Trivia","Music Bingo","Dance Games","Game Show Activities","Photo Challenges","None"]'::jsonb,'{}'::jsonb,'experience.interactive_activities','["builder.selected_services"]'::jsonb),
  ('logistics','venue_access_time','What time can our team access the venue?',null,'time',false,10,'[]'::jsonb,'{}'::jsonb,'venue.access_time','["builder.venue_access_time"]'::jsonb),
  ('logistics','power_available','Is reliable power available near each setup area?',null,'yes_no',false,20,'[]'::jsonb,'{}'::jsonb,'venue.power_available','["builder.power_available"]'::jsonb),
  ('logistics','wifi_available','Is venue Wi-Fi available if needed?',null,'yes_no',false,30,'[]'::jsonb,'{}'::jsonb,'venue.wifi_available','["builder.wifi_available"]'::jsonb)
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