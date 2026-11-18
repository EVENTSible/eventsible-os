import { spawnSync, spawn } from "node:child_process";

const url = process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/^postgresql:\/\/[^/]*127\.0\.0\.1:54322\/postgres$/.test(url)) throw new Error("Disposable loopback database required.");
const args = [url,"--no-password","--no-psqlrc","--quiet","--tuples-only","--no-align","--set","ON_ERROR_STOP=1"];
const env = { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" };
const owner = "19000000-0000-4000-8000-000000000001";
const manager = "19000000-0000-4000-8000-000000000002";
const staff = "19000000-0000-4000-8000-000000000003";
const claims = (id,role) => JSON.stringify({sub:id,role:"authenticated",app_metadata:{role}});
const sql = (id,role,body) => "begin;set local role authenticated;select set_config('request.jwt.claims','" +
  claims(id,role) + "',true);" + body + ";commit;";
function run(statement, expectFailure = false) {
  const result = spawnSync("psql",args,{input:statement,encoding:"utf8",env});
  if ((result.status===0)===expectFailure) throw new Error("Disposable claim check failed: " + String(result.stderr ?? "").slice(0,500));
  return String(result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).at(-1);
}
const people = [
  [owner,"owner","owner-claim@example.invalid"],
  [manager,"manager","manager-claim@example.invalid"],
  [staff,"staff","staff-claim@example.invalid"]
];
for (const [id,role,email] of people) {
  run("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) " +
    "values('00000000-0000-0000-0000-000000000000','" + id + "','authenticated','authenticated','" + email +
    "','',now(),'','','','','{\"role\":\"" + role + "\"}','{}',now(),now());" +
    "update public.os_profiles set display_name='Synthetic " + role + "' where id='" + id + "';");
}
const input = JSON.stringify({
  source:"gigsalad",threadUrl:"https://www.gigsalad.com/synthetic-concurrent-claim-ci",
  contactId:"",clientName:"Synthetic Claim Client",email:"claim-ci@example.invalid",phone:"",
  eventType:"Synthetic Party",eventDate:"2027-02-12",venue:"Synthetic Venue",city:"South Bend",
  summary:"Synthetic event",originalMessage:"Synthetic inquiry",originalReply:"",
  quoteState:"unknown",quoteAmount:"",deposit:"",serviceOptions:"",sentAt:null,
  assignee:"",dueAt:"2027-02-01T12:00:00Z",priority:"normal",screenshotPath:"",
  screenshotType:"",screenshotName:""
});
const created = JSON.parse(run(sql(owner,"owner","select public.os_create_opportunity('29000000-0000-4000-8000-000000000011','" + input + "'::jsonb)")));
const lead = created.leadId;
const claim = (id,role,operation) => new Promise(resolve => {
  const child = spawn("psql",args,{env,stdio:["pipe","pipe","pipe"]});
  let stderr = "";
  child.stderr.on("data",part => stderr += part);
  child.stdout.on("data",() => {});
  child.on("close",code => resolve({code,stderr}));
  child.stdin.end(sql(id,role,"select public.os_follow_up_operation('claim','" + lead +
    "','" + operation + "','{}'::jsonb)"));
});
const results = await Promise.all([
  claim(staff,"staff","39000000-0000-4000-8000-000000000011"),
  claim(manager,"manager","39000000-0000-4000-8000-000000000012")
]);
if (results.filter(result=>result.code===0).length!==1 || results.filter(result=>result.code!==0).length!==1)
  throw new Error("Two concurrent claims did not produce exactly one winner.");
const selected = run("select assigned_to::text from public.os_leads where id='" + lead + "'");
if (run("select assigned_to::text from public.os_tasks where lead_id='" + lead + "'")!==selected)
  throw new Error("Lead and task owners diverged.");
const other = selected===staff ? manager : staff;
const note = "select public.os_follow_up_operation('note','" + lead +
  "','39000000-0000-4000-8000-000000000013','{\"body\":\"Synthetic private note\"}'::jsonb)";
const first = run(sql(selected,selected===staff?"staff":"manager",note));
if (first !== run(sql(selected,selected===staff?"staff":"manager",note)))
  throw new Error("Staff note retry was not idempotent.");
run(sql(other,other===staff?"staff":"manager",
  "select public.os_follow_up_operation('note','" + lead +
  "','39000000-0000-4000-8000-000000000014','{\"body\":\"Unauthorized\"}'::jsonb)"),true);
run(sql(owner,"owner","select public.os_follow_up_operation('assign','" + lead +
  "','39000000-0000-4000-8000-000000000015','{\"assignee\":\"" + other + "\"}'::jsonb)"));
if (run("select assigned_to::text from public.os_leads where id='" + lead + "'")!==other)
  throw new Error("Owner reassignment failed.");
console.log("PASS: disposable single-winner claim, atomic task ownership, private note idempotency and Owner-only reassignment.");
