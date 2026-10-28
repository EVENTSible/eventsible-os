begin read only;
select version,name,cardinality(statements) as statement_entries from supabase_migrations.schema_migrations where version='20261028213219';
select c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('os_site_media','os_site_content_revisions');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('os_site_media','os_site_content_revisions') order by tablename,policyname;
select count(*) as initial_revisions from public.os_site_content_revisions;
select count(*) as initial_media from public.os_site_media;
rollback;
