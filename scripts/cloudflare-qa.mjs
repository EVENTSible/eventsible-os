import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
const [action,lane,...flags]=process.argv.slice(2);
const hq=JSON.parse(fs.readFileSync("package.json")).name==="eventsible-os-admin";
if(!["build","dry-run","deploy","disable"].includes(action)||!(hq?["hq"]:["public","builder"]).includes(lane))throw Error("Expected approved QA action and lane");
if(!fs.existsSync("media-free-release.json"))throw Error("Cloudflare QA requires a prepared media-free input");
const marker=JSON.parse(fs.readFileSync("media-free-release.json"));
if(marker.packageName!==JSON.parse(fs.readFileSync("package.json")).name||marker.version!==1)throw Error("Release identity mismatch");
const config=JSON.parse(fs.readFileSync("cloudflare/"+lane+".json"));
if(config.name!=="eventsible-qa-"+lane+"-20261023"||config.account_id!=="bdc9488066b01f9898727dfdfac8fb74"||config.routes||config.triggers)throw Error("QA target mismatch");
config.workers_dev=action!=="disable"&&flags.includes("--expose-qa");config.preview_urls=config.workers_dev;
const tools=path.resolve("tools/cloudflare/node_modules"),wrangler=path.join(tools,"wrangler/bin/wrangler.js");
function run(file,args,env=process.env){cp.execFileSync(process.execPath,[file,...args],{env,stdio:"inherit"});}
if(action==="build"){
 const env=Object.fromEntries(["PATH","Path","SystemRoot","TEMP","TMP","HOME","USERPROFILE"].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 Object.assign(env,{CI:"1",NEXT_TELEMETRY_DISABLED:"1",EVENTSIBLE_CLOUDFLARE_CONTEXT:"qa",NITRO_PRESET:"cloudflare-module"});
 for(const k of hq?["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]:lane==="builder"?["VITE_SUPABASE_URL","VITE_SUPABASE_PUBLISHABLE_KEY"]:[])if(process.env[k])env[k]=process.env[k];
 if(hq){
  fs.writeFileSync("open-next.config.ts",fs.readFileSync("cloudflare/open-next.config.template"));
  const link=path.resolve("node_modules/@opennextjs");if(!fs.existsSync(link))fs.symlinkSync(path.join(tools,"@opennextjs"),link,process.platform==="win32"?"junction":"dir");
  run(path.join(tools,"@opennextjs/cloudflare/dist/cli/index.js"),["build"],env);
 }else{
  Object.assign(env,{VITE_EVENTSIBLE_SITE_MODE:lane,VITE_EVENTSIBLE_CLOUDFLARE_CONTEXT:"qa",VITE_EVENTSIBLE_QA_PUBLIC_ORIGIN:"https://eventsible-qa-public-20261023.firstfamdjs.workers.dev",VITE_EVENTSIBLE_QA_BUILDER_ORIGIN:"https://eventsible-qa-builder-20261023.firstfamdjs.workers.dev",VITE_EVENTSIBLE_SITE_STUDIO_QA_ORIGIN:"https://eventsible-qa-hq-20261023.firstfamdjs.workers.dev",VITE_EVENTSIBLE_SITE_CONTENT_URL:"https://eventsible-qa-hq-20261023.firstfamdjs.workers.dev/api/public-site/home"});
  run("scripts/check-release-input.mjs",[],env);run("node_modules/vite/bin/vite.js",["build"],env);
 }
}
fs.writeFileSync("wrangler.qa.json",JSON.stringify(config,null,2)+"\n");
if(action==="dry-run")run(wrangler,["deploy","--dry-run","--config","wrangler.qa.json"]);
if(action==="deploy"||action==="disable"){
 // Never upload private credentials or binary source media in a release artifact.
 const secrets=[process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.RESEND_API_KEY].filter(Boolean);
 function scan(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,x.name);if(x.isDirectory())scan(p);else{if(/\.(jpe?g|webp|png|gif|mp[34]|wav|ico|avif|mov|webm|ogg|flac)$/i.test(p))throw Error("Binary media denied");const b=fs.readFileSync(p);if(secrets.some(s=>b.includes(Buffer.from(s))))throw Error("Private credential in artifact");}}}
 scan(hq?".open-next":".output");
 run(wrangler,action==="disable"?["triggers","deploy","--config","wrangler.qa.json"]:["deploy","--config","wrangler.qa.json"]);
}
