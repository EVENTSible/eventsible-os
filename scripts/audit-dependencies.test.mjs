import test from "node:test";
import assert from "node:assert/strict";
import { runAudit } from "./audit-dependencies.mjs";

const clean = {
  status: 0,
  stdout: JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } }),
};
const outage = {
  status: 1,
  stdout: JSON.stringify({ error: { code: "E503", summary: "503 Service Unavailable" } }),
};
const high = {
  status: 1,
  stdout: JSON.stringify({
    metadata: { vulnerabilities: { high: 1, critical: 0 } },
    vulnerabilities: { braces: { severity: "high" } },
  }),
};
const log = { log() {}, error() {} };
test("temporary audit outage retries and can recover", async () => {
  let calls = 0;
  assert.equal(
    await runAudit({ execute: () => (++calls === 1 ? outage : clean), wait: async () => {}, log }),
    0,
  );
  assert.equal(calls, 2);
});
test("three outages remain a release failure", async () => {
  let calls = 0;
  assert.equal(
    await runAudit({
      execute: () => {
        calls++;
        return outage;
      },
      wait: async () => {},
      log,
    }),
    1,
  );
  assert.equal(calls, 3);
});
test("high findings fail immediately without exemption or retries", async () => {
  let calls = 0;
  assert.equal(
    await runAudit({
      execute: () => {
        calls++;
        return high;
      },
      log,
    }),
    1,
  );
  assert.equal(calls, 1);
});
test("malformed or empty audit result cannot pass even at exit zero", async () => {
  for (const stdout of ["", "not json", "{}", '{"error":{"code":"E403"}}']) {
    assert.equal(await runAudit({ execute: () => ({ status: 0, stdout }), log }), 1);
  }
});
test("production scope is explicit; full scope remains default", async () => {
  for (const productionOnly of [false, true]) {
    assert.equal(
      await runAudit({
        productionOnly,
        execute: (_cmd, args) => {
          assert.equal(args.includes("--omit=dev"), productionOnly);
          assert.ok(args.includes("--audit-level=high"));
          return clean;
        },
        log,
      }),
      0,
    );
  }
});
