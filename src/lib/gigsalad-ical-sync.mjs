import {
  GIGSALAD_ICAL_FEED_LIMIT,
  GIGSALAD_ICAL_SOURCE,
  parseGigSaladIcal,
  planGigSaladCandidateSync,
} from "./gigsalad-ical.mjs";

export const GIGSALAD_ICAL_FETCH_TIMEOUT_MS = 12_000;

export class GigSaladSyncError extends Error {
  constructor(code) {
    super(code);
    this.name = "GigSaladSyncError";
    this.code = code;
  }
}

function feedEndpoint(value) {
  const configured = String(value ?? "").trim();
  if (!configured) throw new GigSaladSyncError("feed_not_configured");
  try {
    const endpoint = new URL(configured);
    if (endpoint.protocol === "webcal:") endpoint.protocol = "https:";
    if (endpoint.protocol !== "https:") throw new Error("protocol");
    return endpoint.toString();
  } catch {
    throw new GigSaladSyncError("feed_configuration_invalid");
  }
}

async function boundedResponseText(response, controller) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > GIGSALAD_ICAL_FEED_LIMIT) {
    controller.abort();
    throw new GigSaladSyncError("feed_too_large");
  }

  if (!response.body?.getReader) {
    const body = await response.arrayBuffer();
    if (body.byteLength > GIGSALAD_ICAL_FEED_LIMIT) throw new GigSaladSyncError("feed_too_large");
    return new TextDecoder().decode(body);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > GIGSALAD_ICAL_FEED_LIMIT) {
      controller.abort();
      await reader.cancel().catch(() => undefined);
      throw new GigSaladSyncError("feed_too_large");
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

export async function fetchGigSaladIcal(feedUrl, options = {}) {
  const endpoint = feedEndpoint(feedUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : GIGSALAD_ICAL_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      cache: "no-store",
      headers: { accept: "text/calendar, text/plain;q=0.9" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response?.ok) throw new GigSaladSyncError("feed_fetch_failed");
    return await boundedResponseText(response, controller);
  } catch (error) {
    if (error instanceof GigSaladSyncError) throw error;
    if (controller.signal.aborted) throw new GigSaladSyncError("feed_fetch_timeout");
    throw new GigSaladSyncError("feed_fetch_failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function executeGigSaladCandidateSync(options) {
  const feed = await fetchGigSaladIcal(options.feedUrl, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });

  let parsed;
  try {
    parsed = parseGigSaladIcal(feed);
  } catch {
    throw new GigSaladSyncError("feed_parse_failed");
  }

  const references = parsed.candidates.map((candidate) => candidate.external_reference);
  let existing;
  try {
    existing = references.length ? await options.loadExistingCandidates(references) : [];
  } catch {
    throw new GigSaladSyncError("candidate_read_failed");
  }

  const plan = planGigSaladCandidateSync(parsed.candidates, existing);
  const counts = {
    discovered: parsed.discovered,
    new: 0,
    refreshed: 0,
    unchanged: plan.unchanged,
    preserved: plan.preserved,
    skipped: parsed.skipped + plan.skipped,
    warnings: parsed.warnings.length + plan.warning_count,
  };
  let writeFailures = 0;

  for (const candidate of plan.create) {
    try {
      const result = await options.insertCandidate({
        ...candidate,
        source: GIGSALAD_ICAL_SOURCE,
        created_by_user_id: options.actorUserId,
      });
      if (result === "created") counts.new += 1;
      else if (result === "duplicate") counts.unchanged += 1;
      else {
        counts.skipped += 1;
        counts.warnings += 1;
        writeFailures += 1;
      }
    } catch {
      counts.skipped += 1;
      counts.warnings += 1;
      writeFailures += 1;
    }
  }

  return { counts, write_failures: writeFailures };
}
