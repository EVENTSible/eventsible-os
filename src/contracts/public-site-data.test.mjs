import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSiteRows } from "../lib/public-site-data.ts";
import { formatRevisionTime } from "../lib/revision-time.ts";

test("revision formatting preserves local en-US output without retaining record data",()=>{
  for(const value of ["2026-10-23T17:00:00.000Z","2026-01-01T00:01:02.000Z"]){
    assert.equal(formatRevisionTime(value),new Date(value).toLocaleString("en-US"));
  }
  assert.equal(formatRevisionTime("not a date"),"Unknown time");
});

test("published REST reads are bounded, uncached and do not redirect server credentials", async () => {
  const calls=[];
  const rows=await readSiteRows("http://127.0.0.1:55421", "synthetic-test-key", "os_site_content_revisions", {
    select:"revision,content",page_key:"eq.home",state:"eq.published",limit:"2",
  },async (url,options)=>{calls.push({url:new URL(url),options});return Response.json([{revision:1,content:{heading:"Reviewed"}}]);});
  assert.equal(rows[0].revision,1);
  assert.equal(calls[0].url.pathname,"/rest/v1/os_site_content_revisions");
  assert.equal(calls[0].url.searchParams.get("state"),"eq.published");
  assert.equal(calls[0].options.cache,"no-store");
  assert.equal(calls[0].options.redirect,"manual");
  assert.equal(calls[0].options.headers.Authorization,"Bearer synthetic-test-key");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test("backend failures and malformed envelopes fail closed without leaking backend messages", async () => {
  for(const response of [new Response(null,{status:302,headers:{location:"https://unapproved.example"}}),new Response("private backend diagnostic",{status:503}),Response.json({content:"wrong envelope"}),Response.json([null])]){
    await assert.rejects(readSiteRows("http://127.0.0.1:55421","synthetic-test-key","os_site_media",{},async()=>response),e=>!e.message.includes("private backend diagnostic")&&!e.message.includes("synthetic-test-key"));
  }
});

test("public reader optimization preserves live verification of protected HQ routes",()=>{
  const proxy=fs.readFileSync(new URL("../proxy.ts",import.meta.url),"utf8");
  const session=fs.readFileSync(new URL("../lib/hq-session.ts",import.meta.url),"utf8");
  assert.match(proxy,/pathname === "\/api\/public-site\/home"/);
  assert.match(proxy,/\["GET", "HEAD"\]\.includes\(request.method\)/);
  assert.doesNotMatch(proxy,/getAll\(\)\.length === 0|getSession\(/);
  assert.match(proxy,/await supabase.auth.getUser\(\)/);
  assert.match(session,/await supabase.auth.getUser\(\)/);
  assert.match(session,/cache\(async/);
  assert.doesNotMatch(session,/unstable_cache|use cache|Map\(/);
});
