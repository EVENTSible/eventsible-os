import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createSupabaseKeepaliveHandler,
  runSupabaseKeepaliveChecks,
  SUPABASE_KEEPALIVE_CHECKS,
} from "./supabase-keepalive.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixedNow = new Date("2026-08-30T12:00:00.000Z");

function request(authorization) {
  return new Request("https://example.test/api/cron/supabase-keepalive", {
    headers: authorization ? { authorization } : {},
  });
}

function handler(overrides = {}) {
  return createSupabaseKeepaliveHandler({
    env: { CRON_SECRET: "test-cron-secret" },
    performChecks: async () => ({
      ok: true,
      checksAttempted: 3,
      checksPassed: 3,
    }),
    notifyFailure: async () => {},
    logger: { error() {} },
    now: () => fixedNow,
    clock: (() => {
      const values = [100, 107];
      return () => values.shift() ?? 107;
    })(),
    ...overrides,
  });
}

test("missing authorization returns 401", async () => {
  const response = await handler()(request());
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("invalid authorization returns 401", async () => {
  const response = await handler()(request("Bearer wrong-secret"));
  assert.equal(response.status, 401);
});

test("a missing CRON_SECRET fails closed", async () => {
  let reachedChecks = false;
  const response = await handler({
    env: {},
    performChecks: async () => {
      reachedChecks = true;
      return { ok: true, checksAttempted: 3, checksPassed: 3 };
    },
  })(request("Bearer undefined"));

  assert.equal(response.status, 401);
  assert.equal(reachedChecks, false);
});

test("correct authorization reaches the database checks and returns a sanitized success", async () => {
  let reachedChecks = false;
  const response = await handler({
    performChecks: async () => {
      reachedChecks = true;
      return {
        ok: true,
        checksAttempted: 3,
        checksPassed: 3,
        customerRows: [{ email: "private@example.test" }],
      };
    },
  })(request("Bearer test-cron-secret"));

  assert.equal(reachedChecks, true);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    timestamp: fixedNow.toISOString(),
    checksAttempted: 3,
    checksPassed: 3,
    durationMs: 7,
  });
});

test("a Supabase failure returns a sanitized non-200 response and requests an alert", async () => {
  const logged = [];
  const alerts = [];
  const response = await handler({
    performChecks: async () => {
      throw new Error(
        "raw backend failure service_role=secret-value customer=private@example.test",
      );
    },
    notifyFailure: async (summary) => alerts.push(summary),
    logger: { error: (message) => logged.push(message) },
  })(request("Bearer test-cron-secret"));

  assert.equal(response.status, 503);
  const bodyText = await response.text();
  assert.doesNotMatch(bodyText, /secret-value|private@example\.test|service_role/i);
  assert.deepEqual(JSON.parse(bodyText), {
    ok: false,
    timestamp: fixedNow.toISOString(),
    checksAttempted: 0,
    checksPassed: 0,
    durationMs: 7,
  });
  assert.equal(alerts.length, 1);
  assert.doesNotMatch(logged.join("\n"), /secret-value|private@example\.test/i);
});

test("keep-alive database activity performs only count-backed reads", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return {
        select(column, options) {
          calls.push(["select", table, column, options]);
          return {
            async limit(value) {
              calls.push(["limit", table, value]);
              return { count: 0, error: null };
            },
          };
        },
      };
    },
  };

  const result = await runSupabaseKeepaliveChecks(client);
  assert.deepEqual(result, {
    ok: true,
    checksAttempted: 3,
    checksPassed: 3,
  });
  assert.deepEqual(
    calls.filter(([name]) => name === "from").map(([, table]) => table),
    SUPABASE_KEEPALIVE_CHECKS.map(({ table }) => table),
  );
  for (const [, , , options] of calls.filter(([name]) => name === "select")) {
    assert.deepEqual(options, { count: "exact", head: true });
  }

  const implementation = await readFile(
    resolve(repoRoot, "src/lib/reliability/supabase-keepalive.mjs"),
    "utf8",
  );
  assert.doesNotMatch(
    implementation,
    /\.(?:insert|update|upsert|delete|rpc)\s*\(/,
  );
});

test("vercel.json is valid and configures one Hobby-compatible daily cron", async () => {
  const config = JSON.parse(
    await readFile(resolve(repoRoot, "vercel.json"), "utf8"),
  );

  assert.ok(Array.isArray(config.crons));
  assert.ok(config.crons.length <= 2);
  assert.deepEqual(config.crons, [
    {
      path: "/api/cron/supabase-keepalive",
      schedule: "20 10 * * *",
    },
  ]);

  const [minute, hour, dayOfMonth, month, dayOfWeek] =
    config.crons[0].schedule.split(/\s+/);
  assert.match(minute, /^\d{1,2}$/);
  assert.match(hour, /^\d{1,2}$/);
  assert.deepEqual([dayOfMonth, month, dayOfWeek], ["*", "*", "*"]);
});
