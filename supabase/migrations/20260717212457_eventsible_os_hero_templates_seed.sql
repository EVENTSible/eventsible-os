insert into public.os_planning_templates(slug,name,event_type,version,status,description,assignment_rules,settings)
values
('wedding-hero','Wedding Hero','wedding',1,'published','Guided wedding ceremony and reception planning experience','{"event_types":["wedding"],"auto_assign_when_booked":true}'::jsonb,'{"brand":"Wedding Hero","autosave":true,"progress_milestones":[25,50,75,100]}'::jsonb),
('event-hero','Event Hero',null,1,'published','Guided planning experience for non-wedding events','{"exclude_event_types":["wedding"],"auto_assign_when_booked":true}'::jsonb,'{"brand":"Event Hero","autosave":true,"progress_milestones":[25,50,75,100]}'::jsonb)
on conflict(slug,version) do update set
  name=excluded.name,
  event_type=excluded.event_type,
  status=excluded.status,
  description=excluded.description,
  assignment_rules=excluded.assignment_rules,
  settings=excluded.settings;

insert into public.os_planning_sections(template_id,section_key,title,description,sort_order,condition)
select pt.id,s.section_key,s.title,s.description,s.sort_order,s.condition
from public.os_planning_templates pt
join (values
  ('wedding-hero','event_basics','Your Wedding','Confirm the essentials already gathered during booking.',10,'{}'::jsonb),
  ('wedding-hero','ceremony','Ceremony','Music, microphones, processional details and ceremony logistics.',20,'{"any":[{"fact":"services.ceremony_audio","equals":true},{"answer":"ceremony_included","equals":true}]}'::jsonb),
  ('wedding-hero','reception','Reception Flow','Introductions, formal moments and reception timeline.',30,'{}'::jsonb),
  ('wedding-hero','music','Music & Vibe','Must-plays, do-not-plays, special songs and overall energy.',40,'{}'::jsonb),
  ('wedding-hero','logistics','Venue & Vendor Logistics','Access, power, Wi-Fi, weather backup and vendor coordination.',50,'{}'::jsonb),
  ('wedding-hero','services','Booked Services','Preferences for Photo Booths, lighting, games and other booked services.',60,'{}'::jsonb),
  ('event-hero','event_basics','Your Event','Confirm the essentials already gathered during booking.',10,'{}'::jsonb),
  ('event-hero','experience','Goals & Guest Experience','Purpose, audience, theme and what success should feel like.',20,'{}'::jsonb),
  ('event-hero','entertainment','Music & Entertainment','Music, karaoke, games, announcements and participation.',30,'{}'::jsonb),
  ('event-hero','logistics','Venue & Logistics','Access, power, Wi-Fi, schedule and contingency planning.',40,'{}'::jsonb),
  ('event-hero','services','Booked Services','Preferences for each selected EVENTSible service.',50,'{}'::jsonb)
) as s(template_slug,section_key,title,description,sort_order,condition)
  on s.template_slug=pt.slug
where pt.version=1
on conflict(template_id,section_key) do update set
  title=excluded.title,
  description=excluded.description,
  sort_order=excluded.sort_order,
  condition=excluded.condition;