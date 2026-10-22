import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("provider builds reject raw source and contaminated media-free input", () => {
  const root=process.cwd(), fixture=fs.mkdtempSync(path.join(root,".release-guard-test-"));
  const script=path.join(root,"scripts/check-release-input.mjs");
  const check=(env)=>spawnSync(process.execPath,[script],{cwd:fixture,env:{...process.env,...env},encoding:"utf8"}).status;
  try {
    fs.writeFileSync(path.join(fixture,"package.json"),JSON.stringify({name:"eventsible-release-test"}));
    assert.notEqual(check({NETLIFY:"true"}),0);
    assert.notEqual(check({NETLIFY:"",VERCEL_ENV:"production"}),0);
    fs.writeFileSync(path.join(fixture,"media-free-release.json"),JSON.stringify({version:1,packageName:"eventsible-release-test"}));
    fs.mkdirSync(path.join(fixture,"public"));
    fs.writeFileSync(path.join(fixture,"public/illustration.svg"),'<svg xmlns="http://www.w3.org/2000/svg"/>');
    assert.equal(check({NETLIFY:"true"}),0);
    fs.writeFileSync(path.join(fixture,"public/unapproved.jpg"),"synthetic contaminated fixture");
    assert.notEqual(check({NETLIFY:"true"}),0);
  } finally {
    assert.ok(fixture.startsWith(root+path.sep+".release-guard-test-"));
    fs.rmSync(fixture,{recursive:true});
  }
});
