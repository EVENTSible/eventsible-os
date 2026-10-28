import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedStudioIssuer,
  issueStudioCapability,
  readPreviewBody,
  studioFrameOrigin,
  verifyStudioCapability,
} from "../lib/site-studio-preview-session.mjs";
const secret = "synthetic-test-only-preview-signing-key",
  now = 1000000;
const request = {
  issuer: "https://eventsible-hq-example.vercel.app",
  audience: "https://eventsible-info-example.vercel.app",
  channel: "11111111-1111-4111-8111-111111111111",
  frameNonce: "22222222-2222-4222-8222-222222222222",
};
test("Owner rendering capability is bounded to audience, frame, channel and 90 seconds; contains no session/draft", () => {
  const token = issueStudioCapability(request, secret, now);
  const context = verifyStudioCapability(
    token.capability,
    request.audience,
    secret,
    now,
  );
  assert.equal(context.issuer, request.issuer);
  assert.equal(context.expiresAt, now + 90000);
  assert.deepEqual(Object.keys(context).sort(), [
    "audience",
    "channel",
    "expiresAt",
    "frameNonce",
    "issuer",
    "version",
  ]);
  assert.equal(
    verifyStudioCapability(
      token.capability,
      "https://attacker.invalid",
      secret,
      now,
    ),
    null,
  );
  assert.equal(
    verifyStudioCapability(
      token.capability,
      request.audience,
      secret,
      now + 90000,
    ),
    null,
  );
  assert.equal(
    verifyStudioCapability(
      token.capability,
      request.audience,
      "a-different-synthetic-secret",
      now,
    ),
    null,
  );
  assert.equal(
    verifyStudioCapability(
      token.capability.slice(0, -3) + "abc",
      request.audience,
      secret,
      now,
    ),
    null,
  );
  assert.equal(
    verifyStudioCapability("x".repeat(3000), request.audience, secret, now),
    null,
  );
});
test("preview endpoints bound streamed request bodies before parsing", async () => {
  assert.equal(
    await readPreviewBody(
      new Request("https://hq.invalid", { method: "POST", body: "test" }),
      4,
    ),
    "test",
  );
  await assert.rejects(
    readPreviewBody(
      new Request("https://hq.invalid", { method: "POST", body: "large" }),
      4,
    ),
  );
});
test("hosted origin configuration is exact; Production ignores Preview overrides", () => {
  assert.equal(
    studioFrameOrigin({
      VERCEL_ENV: "production",
      EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL: "https://attacker.invalid",
    }),
    "https://eventsible.info",
  );
  assert.equal(studioFrameOrigin({ VERCEL_ENV: "preview" }), null);
  for (const value of [
    "https://attacker.invalid",
    "https://eventsible-info-x.vercel.app.attacker.invalid",
    "https://eventsible-info-x.vercel.app/?x=1",
    "https://user@eventsible-info-x.vercel.app/",
  ])
    assert.equal(
      studioFrameOrigin({
        VERCEL_ENV: "preview",
        EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL: value,
      }),
      null,
    );
  assert.equal(
    studioFrameOrigin({
      VERCEL_ENV: "preview",
      EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL: request.audience + "/",
    }),
    request.audience,
  );
  assert.equal(
    allowedStudioIssuer(request.issuer, {
      VERCEL_ENV: "preview",
      VERCEL_URL: new URL(request.issuer).host,
    }),
    true,
  );
  assert.equal(
    allowedStudioIssuer("https://attacker.vercel.app", {
      VERCEL_ENV: "preview",
      VERCEL_URL: new URL(request.issuer).host,
    }),
    false,
  );
});
