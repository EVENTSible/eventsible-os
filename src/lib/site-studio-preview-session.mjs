import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const PREVIEW_LIFETIME_SECONDS = 90;
export async function readPreviewBody(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing preview request");
  const chunks = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Oversized preview request");
    }
    chunks.push(Buffer.from(result.value));
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function exactOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
export function studioFrameOrigin(env = process.env) {
  if (env.VERCEL_ENV === "production") return "https://eventsible.info";
  if (env.VERCEL_ENV !== "preview") return null;
  const origin = exactOrigin(env.EVENTSIBLE_SITE_STUDIO_PUBLIC_PREVIEW_URL);
  return origin &&
    new URL(origin).hostname.startsWith("eventsible-info-") &&
    new URL(origin).hostname.endsWith(".vercel.app")
    ? origin
    : null;
}
export function allowedStudioIssuer(origin, env = process.env) {
  const exact = exactOrigin(origin);
  if (!exact) return false;
  return (
    (env.VERCEL_ENV === "production" && exact === "https://eventsible.biz") ||
    (!!env.VERCEL_URL && exact === exactOrigin(`https://${env.VERCEL_URL}`))
  );
}
function mac(payload, secret) {
  if (typeof secret !== "string" || secret.length < 20)
    throw new Error("Preview authorization unavailable");
  const key = createHmac("sha256", secret)
    .update("eventsible:site-studio:private-render:v2")
    .digest();
  return createHmac("sha256", key).update(payload).digest();
}
export function issueStudioCapability(
  { issuer, audience, channel, frameNonce },
  secret,
  now = Date.now(),
) {
  if (
    !exactOrigin(issuer) ||
    !exactOrigin(audience) ||
    !UUID.test(channel) ||
    !UUID.test(frameNonce)
  ) {
    throw new Error("Invalid preview session");
  }
  const iat = Math.floor(now / 1000);
  const data = {
    version: 2,
    scope: "site-studio:private-render",
    issuer,
    audience,
    channel,
    frameNonce,
    iat,
    exp: iat + PREVIEW_LIFETIME_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return {
    capability: `${payload}.${mac(payload, secret).toString("base64url")}`,
    expiresAt: data.exp * 1000,
  };
}
export function verifyStudioCapability(
  token,
  audience,
  secret,
  now = Date.now(),
) {
  try {
    if (
      typeof token !== "string" ||
      token.length > 2048 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)
    )
      return null;
    const [encoded, signature] = token.split("."),
      expected = mac(encoded, secret),
      actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
      seconds = Math.floor(now / 1000);
    if (
      data.version !== 2 ||
      data.scope !== "site-studio:private-render" ||
      !exactOrigin(data.issuer) ||
      !exactOrigin(data.audience) ||
      data.audience !== audience ||
      !UUID.test(data.channel) ||
      !UUID.test(data.frameNonce) ||
      !Number.isSafeInteger(data.iat) ||
      !Number.isSafeInteger(data.exp) ||
      data.iat > seconds + 5 ||
      data.exp <= seconds ||
      data.exp - data.iat !== PREVIEW_LIFETIME_SECONDS
    )
      return null;
    return {
      version: 2,
      issuer: data.issuer,
      audience: data.audience,
      channel: data.channel,
      frameNonce: data.frameNonce,
      expiresAt: data.exp * 1000,
    };
  } catch {
    return null;
  }
}
