import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { APPROVED_HQ_ICONS } from "../../scripts/approved-hq-icons.mjs";

test("provider builds reject raw source and contaminated media-free input", () => {
  const root=process.cwd(), fixture=fs.mkdtempSync(path.join(root,".release-guard-test-"));
  const script=path.join(root,"scripts/check-release-input.mjs");
  const check=(env)=>spawnSync(process.execPath,[script],{cwd:fixture,env:{...process.env,...env},encoding:"utf8"}).status;
  try {
    fs.writeFileSync(path.join(fixture,"package.json"),JSON.stringify({name:"eventsible-release-test"}));
    assert.notEqual(check({NETLIFY:"true"}),0);
    assert.notEqual(check({NETLIFY:"",VERCEL_ENV:"production"}),0);
    assert.notEqual(check({NETLIFY:"",VERCEL_ENV:"preview"}),0);
    fs.writeFileSync(path.join(fixture,"media-free-release.json"),JSON.stringify({version:1,packageName:"eventsible-release-test",approvedAppIcons:Object.entries(APPROVED_HQ_ICONS).map(([iconPath,sha256])=>({path:iconPath,sha256}))}));
    fs.mkdirSync(path.join(fixture,"public"));
    fs.writeFileSync(path.join(fixture,"public/illustration.svg"),'<svg xmlns="http://www.w3.org/2000/svg"/>');
    for(const iconPath of Object.keys(APPROVED_HQ_ICONS)){
      fs.mkdirSync(path.dirname(path.join(fixture,iconPath)),{recursive:true});
      fs.copyFileSync(path.join(root,iconPath),path.join(fixture,iconPath));
    }
    assert.equal(check({NETLIFY:"true"}),0);
    assert.equal(check({NETLIFY:"",VERCEL_ENV:"preview"}),0);
    const approvedIcon=path.join(fixture,"public/hq/icon-192.png");
    fs.appendFileSync(approvedIcon,"tampered icon");
    assert.notEqual(check({NETLIFY:"true"}),0);
    fs.copyFileSync(path.join(root,"public/hq/icon-192.png"),approvedIcon);
    fs.writeFileSync(path.join(fixture,"public/unapproved.jpg"),"synthetic contaminated fixture");
    assert.notEqual(check({NETLIFY:"true"}),0);
  } finally {
    assert.ok(fixture.startsWith(root+path.sep+".release-guard-test-"));
    fs.rmSync(fixture,{recursive:true});
  }
});
