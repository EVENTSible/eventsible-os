import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Absolutely no remote database is permitted by this synthetic QA harness.
const databaseUrl = process.env.SUPABASE_LOCAL_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const parsed = new URL(databaseUrl);
assert(["127.0.0.1","localhost","::1"].includes(parsed.hostname), "Only disposable loopback PostgreSQL is allowed");
assert(!/supabase\\.co/i.test(databaseUrl), "Production/remote DB URL forbidden");
const env = { ...process.env, PGPASSWORD: process.env.PGPASSWORD || "postgres" };

function psql(statement, expectFailure = false) {
  const args = [databaseUrl, "--no-password", "--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", statement];
  const result = spawnSync("psql", args, { encoding: "utf8", env });
  if (expectFailure) {
    assert.notEqual(result.status, 0, "Expected statement to fail but it succeeded");
    return "";
  }
  if (result.status !== 0) throw new Error("Site Studio isolated SQL verification failed: " + String(result.stderr || result.stdout).slice(0,1000));
  return String(result.stdout || "").trim().split(/\\r?\\n/).filter(Boolean).at(-1) || "";
}
const owner = "55000000-0000-4000-8000-000000000001";
const staff = "55000000-0000-4000-8000-000000000002";
const mediaId = "55000000-0000-4000-8000-000000000003";
const notApprovedId = "55000000-0000-4000-8000-000000000004";
const rev1 = "55000000-0000-4000-8000-000000000005";
const rev2 = "55000000-0000-4000-8000-000000000006";
const revUnapproved = "55000000-0000-4000-8000-000000000007";
const claims = (id, role) => JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated", app_metadata: { role } }).replaceAll("'", "''");
const asUser = (id, role, statement, expectFailure = false) => psql(
  `begin; set local role authenticated; select set_config('request.jwt.claims','${claims(id, role)}',true); ${statement}; commit;`,
  expectFailure
);
const JSONtext = (object) => JSON.stringify(object).replaceAll("'","''");

assert.equal(psql("select current_database()"), "postgres");
assert.equal(psql("select to_regclass('public.os_site_content_revisions') is null"), "t", "Do not reapply over an existing schema");
const proposal = resolve("supabase/proposals/20261020_site_studio_v1.sql");
execFileSync("psql", [databaseUrl, "--no-password", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--file", proposal], { encoding: "utf8", env, stdio: "pipe" });
assert.equal(psql("select relrowsecurity from pg_class where oid='public.os_site_content_revisions'::regclass"), "t");
assert.equal(psql("select relrowsecurity from pg_class where oid='public.os_site_media'::regclass"), "t");
assert.equal(psql("select not has_table_privilege('anon','public.os_site_media','SELECT')"), "t");
assert.equal(psql("select not has_table_privilege('anon','public.os_site_content_revisions','SELECT')"), "t");
assert.equal(psql("select not has_table_privilege('authenticated','public.os_site_media','INSERT')"), "t");
assert.equal(psql("select not has_table_privilege('authenticated','public.os_site_content_revisions','UPDATE')"), "t");
assert.equal(psql("select not has_function_privilege('anon','public.os_site_publish_revision(uuid)','EXECUTE')"), "t");

// Synthetic fixtures live in the disposable local container only.
psql(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','${owner}','authenticated','authenticated','site-owner@example.invalid','',now(),'','','','','{"role":"owner"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${staff}','authenticated','authenticated','site-staff@example.invalid','',now(),'','','','','{"role":"staff"}','{}',now(),now()) on conflict(id) do nothing`);
psql(`insert into public.os_site_media(id,drive_file_id,title,public_url,alt_text,status,permission_confirmed,usage_approved) values
('${mediaId}','synthetic-approved-drive-id','Synthetic approved photo','https://media.example.invalid/approved.jpg','Synthetic event','approved',true,true),
('${notApprovedId}','synthetic-private-drive-id','Synthetic not approved','https://media.example.invalid/private.jpg','Private event','candidate',false,false)`);

const draft = (id, media) => `insert into public.os_site_content_revisions(id,page_key,state,created_by,content) values
('${id}','home','draft','${owner}','${JSONtext({heading:"An EVENTSible",highlight:"Experience",subheading:"Synthetic private QA copy.",hero_media_id:media})}'::jsonb)`;
psql("begin; set local role anon; select count(*) from public.os_site_content_revisions; rollback;", true);
assert.equal(asUser(staff,"staff","select count(*) from public.os_site_content_revisions"), "0");
asUser(staff,"staff",draft(revUnapproved,notApprovedId),true);
asUser(owner,"owner",draft(rev1,mediaId));
asUser(owner,"owner",draft(rev2,mediaId));
asUser(owner,"owner",draft(revUnapproved,notApprovedId));
assert.equal(asUser(owner,"owner","select count(*) from public.os_site_content_revisions"),"3");
asUser(staff,"staff",`select public.os_site_publish_revision('${rev1}')`,true);
asUser(owner,"owner",`select public.os_site_publish_revision('${revUnapproved}')`,true);
assert.equal(psql("select count(*) from public.os_site_content_revisions where state='published'"),"0");
asUser(owner,"owner",`select public.os_site_publish_revision('${rev1}')`);
assert.equal(psql(`select state from public.os_site_content_revisions where id='${rev1}'`),"published");
asUser(owner,"owner",`select public.os_site_publish_revision('${rev2}')`);
assert.equal(psql(`select state from public.os_site_content_revisions where id='${rev1}'`),"archived");
assert.equal(psql("select count(*) from public.os_site_content_revisions where state='published'"),"1");
asUser(owner,"owner",`select public.os_site_publish_revision('${rev1}')`);
assert.equal(psql(`select state from public.os_site_content_revisions where id='${rev1}'`),"published");
assert.equal(psql("select count(*) from public.os_site_content_revisions where state='published'"),"1");
asUser(owner,"owner",`update public.os_site_content_revisions set content='{}'::jsonb where id='${rev1}'`,true);
console.log("PASS: isolated Site Studio DDL, owner/staff/anon RLS, media approval, single publication, rollback-by-republish, and denial of direct writes.");
