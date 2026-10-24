import test from "node:test";
import assert from "node:assert/strict";
import { isProductionDeployment, cloudflareQaOrigin } from "./deployment-context.mjs";
import { resolveNotificationConfig } from "../notifications/builder-lead-email.mjs";
import { resolveWeddingHeroNotificationConfig } from "../notifications/wedding-hero-email.mjs";
test("Cloudflare QA and unknown context override stale Production metadata and force dry run",()=>{
 for(const context of ["qa","unknown","production"]){
 const env={EVENTSIBLE_CLOUDFLARE_CONTEXT:context,EVENTSIBLE_CLOUDFLARE_APP_ORIGIN:"https://eventsible-qa-hq-20261023.firstfamdjs.workers.dev",VERCEL_ENV:"production",NETLIFY:"true",CONTEXT:"production",RESEND_API_KEY:"synthetic-only",WEDDING_HERO_NOTIFY_EMAIL:"qa@example.invalid",WEDDING_HERO_SITE_URL:"https://eventsible.biz"};
 assert.equal(isProductionDeployment(env),false);assert.equal(resolveNotificationConfig(env).dryRun,true);assert.equal(resolveWeddingHeroNotificationConfig(env).dryRun,true);
 assert.equal(resolveWeddingHeroNotificationConfig(env).siteUrl,context==="qa"?env.EVENTSIBLE_CLOUDFLARE_APP_ORIGIN:"");
 }
});
test("Cloudflare QA origin never falls back to live or accepts credentials/path/lookalike hosts",()=>{
 for(const origin of ["https://eventsible.biz","https://user:pass@eventsible-qa-hq-20261023.firstfamdjs.workers.dev","https://eventsible-qa-hq-20261023.firstfamdjs.workers.dev/", "https://eventsible-qa-hq-20261023.firstfamdjs.workers.dev.attacker.invalid"]){assert.equal(cloudflareQaOrigin({EVENTSIBLE_CLOUDFLARE_CONTEXT:"qa",EVENTSIBLE_CLOUDFLARE_APP_ORIGIN:origin}),"");}
});
