insert into public.os_service_catalog(code,name,category,planning_module,default_unit,sort_order,metadata) values
('wedding_dj_mc','Wedding DJ & MC','Weddings','wedding_hero','hour',10,'{"minimum_target_rate":200}'::jsonb),
('dj_mc','DJ & MC','DJ Services','event_hero','hour',20,'{}'::jsonb),
('karaoke','Karaoke / Video DJ','Karaoke','event_hero','hour',30,'{}'::jsonb),
('selfie_booth_digital','Selfie Booth - Digital','Photo Booths','event_hero','hour',40,'{}'::jsonb),
('selfie_booth_prints','Selfie Booth + Prints','Photo Booths','event_hero','hour',41,'{"memory_book_included":true}'::jsonb),
('booth_360','360 Photo Booth','Photo Booths','event_hero','hour',42,'{"minimum_hours":2}'::jsonb),
('uplighting','Uplighting','Lighting & Effects','event_hero','flat',50,'{}'::jsonb),
('interactive_games','Interactive Games & Trivia','Games & Activities','event_hero','flat',60,'{}'::jsonb),
('kids_entertainment','Kids DJ & Party Entertainment','Kids Events','event_hero','hour',70,'{"party_helpers_supported":true}'::jsonb),
('bartending','Bartending Service','Bartending','event_hero','hour',80,'{"default_servers":2}'::jsonb),
('rentals','Event Rentals','Rentals','event_hero','flat',90,'{}'::jsonb),
('custom_creations','Custom Creations / T-Shirt & Gift Bar','Custom Creations','event_hero','flat',100,'{}'::jsonb),
('live_performer','Live Performer / Singer','Live Entertainment','event_hero','flat',110,'{}'::jsonb),
('officiant','Wedding Officiant','Weddings','wedding_hero','flat',120,'{}'::jsonb),
('beauty_services','Wedding Beauty / Hairstyling','Weddings','wedding_hero','flat',130,'{}'::jsonb)
on conflict(code) do update set
  name=excluded.name,
  category=excluded.category,
  planning_module=excluded.planning_module,
  default_unit=excluded.default_unit,
  sort_order=excluded.sort_order,
  metadata=excluded.metadata,
  is_active=true;