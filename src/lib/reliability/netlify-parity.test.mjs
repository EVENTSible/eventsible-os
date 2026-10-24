import test from "node:test";
import assert from "node:assert/strict";
import { runNetlifyKeepalive } from "./netlify-keepalive.mjs";
import { resolveNotificationConfig } from "../notifications/builder-lead-email.mjs";
import { resolveWeddingHeroNotificationConfig } from "../notifications/wedding-hero-email.mjs";

test("scheduled Preview/disabled jobs cannot call the backend even if credentials are present", async () => {
  for(const env of [{NETLIFY:"true",CONTEXT:"deploy-preview",EVENTSIBLE_NETLIFY_KEEPALIVE_ENABLED:"true"},{NETLIFY:"true",CONTEXT:"production"}]) {
    const result=await runNetlifyKeepalive({env,check:()=>{throw Error("Backend must not be reached")},notify:()=>{throw Error("Mail must not be reached")}});
    assert.equal(result.skipped,true);
  }
});
const enabled={NETLIFY:"true",CONTEXT:"production",EVENTSIBLE_NETLIFY_KEEPALIVE_ENABLED:"true",NEXT_PUBLIC_SUPABASE_URL:"https://synthetic.invalid",SUPABASE_SERVICE_ROLE_KEY:"synthetic-test-only"};
const deployment={context:"production",published:true};
test("enabled scheduler requires explicit runtime configuration and reports failed checks", async () => {
  await assert.rejects(runNetlifyKeepalive({env:{...enabled,SUPABASE_SERVICE_ROLE_KEY:""},deployment}),/configuration missing/);
  let alerted=0;
  await assert.rejects(runNetlifyKeepalive({env:enabled,deployment,check:async()=>({ok:false,checksAttempted:3,checksPassed:2}),notify:async()=>{alerted++;throw Error("Synthetic alert failure")}}),/checks failed/);
  assert.equal(alerted,1);
  assert.deepEqual(await runNetlifyKeepalive({env:enabled,deployment,check:async()=>({ok:true,checksAttempted:3,checksPassed:3})}),{ok:true,checksAttempted:3,checksPassed:3});
  assert.equal((await runNetlifyKeepalive({env:enabled,deployment:{context:"production",published:false}})).skipped,true);
});
test("Netlify notification context preserves Production missing-key failure and blocks Preview sends", () => {
  assert.equal(resolveNotificationConfig({NETLIFY:"true",CONTEXT:"production"}).dryRun,false);
  assert.equal(resolveNotificationConfig({SITE_ID:"synthetic",EVENTSIBLE_NETLIFY_CONTEXT:"production"}).dryRun,false);
  assert.equal(resolveNotificationConfig({SITE_ID:"synthetic",RESEND_API_KEY:"synthetic-only"}).dryRun,true);
  assert.equal(resolveNotificationConfig({NETLIFY:"true",CONTEXT:"deploy-preview",RESEND_API_KEY:"synthetic-only"}).dryRun,true);
  const preview=resolveWeddingHeroNotificationConfig({NETLIFY:"true",CONTEXT:"deploy-preview",DEPLOY_URL:"https://draft--synthetic.netlify.app",NEXT_PUBLIC_SITE_URL:"https://eventsible.biz",RESEND_API_KEY:"synthetic-only"});
  assert.equal(preview.dryRun,true);assert.equal(preview.siteUrl,"https://draft--synthetic.netlify.app");
  assert.equal(resolveWeddingHeroNotificationConfig({NETLIFY:"true",CONTEXT:"production",NEXT_PUBLIC_SITE_URL:"https://eventsible.biz",VERCEL_URL:"stale.vercel.app"}).siteUrl,"https://eventsible.biz");
});
