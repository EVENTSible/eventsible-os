import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_WEDDING_HERO_SUPPORT_EMAIL,
  validateWeddingHeroContactRequest,
  WEDDING_HERO_PHONE_DISPLAY,
  WEDDING_HERO_PHONE_SMS,
  WEDDING_HERO_PHONE_TEL,
} from "../wedding-hero-contact.mjs";
import {
  buildWeddingHeroOwnerNotification,
  resolveWeddingHeroNotificationConfig,
  WEDDING_HERO_CALLBACK_NOTIFICATION,
  WEDDING_HERO_SUBMITTED_NOTIFICATION,
} from "./wedding-hero-email.mjs";
import { validateWeddingHeroPlanSubmission } from "../wedding-hero-submission.mjs";

const eventId = "72624d36-6db8-4839-a2b2-ecb201ebc313";
const assignmentId = "f201f84b-aa24-4b3a-9464-1d1ed6407d16";

test("Wedding Hero exposes the approved client phone links", () => {
  assert.equal(WEDDING_HERO_PHONE_DISPLAY, "+1 (574) 274-5213");
  assert.equal(WEDDING_HERO_PHONE_TEL, "tel:+15742745213");
  assert.equal(WEDDING_HERO_PHONE_SMS, "sms:+15742745213");

  const component = readFileSync(new URL("../../components/wedding-hero-contact.tsx", import.meta.url), "utf8");
  assert.match(component, /Request callback/);
  assert.match(component, /mailto:/);
  assert.match(component, /WEDDING_HERO_PHONE_SMS/);
  assert.match(component, /WEDDING_HERO_PHONE_TEL/);
});

test("callback validation accepts a usable request and normalizes context", () => {
  const result = validateWeddingHeroContactRequest({
    name: " Jordan Example ",
    email: "JORDAN@EXAMPLE.COM",
    phone: "(574) 555-0111",
    preferredChannel: "text",
    bestTime: "After 5 PM",
    notes: "Help with ceremony audio.",
    coupleNames: "Jordan & Casey",
    eventDate: "2026-10-10",
    progress: 47.6,
    mode: "guided",
    source: "private_plan",
    eventId,
    assignmentId,
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.name, "Jordan Example");
  assert.equal(result.data.email, "jordan@example.com");
  assert.equal(result.data.progress, 48);
  assert.equal(result.data.eventId, eventId);
});

test("callback validation rejects missing contact details and malformed private-plan IDs", () => {
  const missingContact = validateWeddingHeroContactRequest({ name: "Jordan", preferredChannel: "call" });
  assert.equal(missingContact.ok, false);
  assert.match(missingContact.message, /email address or phone number/i);

  const malformedPlan = validateWeddingHeroContactRequest({
    name: "Jordan",
    email: "jordan@example.com",
    preferredChannel: "email",
    eventId: "not-a-plan",
  });
  assert.equal(malformedPlan.ok, false);
  assert.match(malformedPlan.message, /plan connection/i);
});

test("callback validation blocks the honeypot without accepting contact data", () => {
  const result = validateWeddingHeroContactRequest({
    name: "Jordan",
    email: "jordan@example.com",
    preferredChannel: "email",
    company: "spam payload",
  });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test("missing Wedding Hero notification env uses a safe dry-run fallback", () => {
  const config = resolveWeddingHeroNotificationConfig({});
  assert.equal(config.recipient, DEFAULT_WEDDING_HERO_SUPPORT_EMAIL);
  assert.equal(config.supportEmail, DEFAULT_WEDDING_HERO_SUPPORT_EMAIL);
  assert.equal(config.dryRun, true);
  assert.equal(config.resendApiKey, undefined);

  const sharedProviderWithoutRecipient = resolveWeddingHeroNotificationConfig({ RESEND_API_KEY: "shared-provider-key" });
  assert.equal(sharedProviderWithoutRecipient.dryRun, true);
});

test("owner callback email includes operational context and reply information", () => {
  const config = resolveWeddingHeroNotificationConfig({
    WEDDING_HERO_NOTIFY_EMAIL: "owner@example.com",
    WEDDING_HERO_SUPPORT_EMAIL: "help@example.com",
    WEDDING_HERO_NOTIFICATION_DRY_RUN: "true",
    WEDDING_HERO_SITE_URL: "https://preview.example.com",
  });
  const email = buildWeddingHeroOwnerNotification({
    kind: WEDDING_HERO_CALLBACK_NOTIFICATION,
    context: { coupleNames: "Jordan & Casey", eventDate: "2026-10-10", progress: 48, mode: "guided", source: "private_plan", eventId, assignmentId },
    request: { name: "Jordan", email: "jordan@example.com", phone: "5745550111", preferredChannel: "text", bestTime: "After 5 PM", notes: "Ceremony audio" },
    requestId: "callback-request-id",
    createdAt: "2026-08-22T12:00:00.000Z",
    config,
  });

  assert.equal(email.replyTo, "jordan@example.com");
  assert.match(email.text, /Jordan & Casey/);
  assert.match(email.text, /Wedding date: 2026-10-10/);
  assert.match(email.text, /Progress: 48%/);
  assert.match(email.text, /Mode: guided/);
  assert.match(email.text, /Admin plan: https:\/\/preview\.example\.com\/admin\/wedding/);
  assert.match(email.text, /Private plan: https:\/\/preview\.example\.com\/client\/wedding/);
});

test("explicit submission email identifies the submitted plan", () => {
  const config = resolveWeddingHeroNotificationConfig({ WEDDING_HERO_NOTIFICATION_DRY_RUN: "true" });
  const email = buildWeddingHeroOwnerNotification({
    kind: WEDDING_HERO_SUBMITTED_NOTIFICATION,
    context: {
      coupleNames: "Jordan & Casey",
      progress: 84,
      mode: "form",
      source: "private_plan",
      eventId,
      assignmentId,
      email: "jordan@example.com",
      missingCritical: ["Venue access time"],
      ceremonySummary: "Ceremony start: 4:30 PM",
      receptionSummary: "Grand entrance: 6:00 PM",
      timelineSummary: "Grand entrance at 6:00 PM",
      musicSummary: "First dance: At Last",
      serviceSummary: "DJ/MC: Booked",
    },
    requestId: "submission-request-id",
    createdAt: "2026-08-22T12:00:00.000Z",
    config,
  });
  assert.match(email.subject, /Wedding Hero submitted: Jordan & Casey - 84%/);
  assert.match(email.text, /Source: private_plan/);
  assert.match(email.text, /Missing critical fields: Venue access time/);
  assert.match(email.text, /Ceremony summary: Ceremony start: 4:30 PM/);
  assert.match(email.text, /Timeline: Grand entrance at 6:00 PM/);
  assert.match(email.text, /Music summary: First dance: At Last/);
  assert.match(email.text, /Services: DJ\/MC: Booked/);

  const actionSource = readFileSync(new URL("../../app/client/wedding/actions.ts", import.meta.url), "utf8");
  const submitBranch = actionSource.indexOf("if (input.submit)");
  const sendCall = actionSource.indexOf("sendWeddingHeroOwnerNotification", submitBranch);
  assert.ok(submitBranch >= 0 && sendCall > submitBranch);
});

test("public plan submission validation normalizes answers and permits incomplete plans", () => {
  const result = validateWeddingHeroPlanSubmission({
    draftId: "39798e4b-5f7a-4be0-81ef-0d0ecfbeea96",
    submissionId: "30cda6d3-f756-4201-a2f7-c675f9263f39",
    contactName: "Jordan Example",
    email: "JORDAN@EXAMPLE.COM",
    mode: "form",
    sectionKey: "event_basics",
    answers: { partner_one_name: " Jordan ", ceremony_included: "yes", unknown_key: "discard me" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.email, "jordan@example.com");
  assert.equal(result.data.answers.partner_one_name, "Jordan");
  assert.equal(result.data.answers.ceremony_included, true);
  assert.equal("unknown_key" in result.data.answers, false);
  assert.ok(result.data.progress < 100);
});

test("public plan submission validation requires contact information and meaningful planner answers", () => {
  const base = {
    draftId: "39798e4b-5f7a-4be0-81ef-0d0ecfbeea96",
    submissionId: "30cda6d3-f756-4201-a2f7-c675f9263f39",
    contactName: "Jordan Example",
    mode: "form",
  };
  const noContact = validateWeddingHeroPlanSubmission({ ...base, answers: { partner_one_name: "Jordan" } });
  assert.equal(noContact.ok, false);
  assert.match(noContact.message, /email address or phone number/i);

  const noAnswers = validateWeddingHeroPlanSubmission({ ...base, email: "jordan@example.com", answers: {} });
  assert.equal(noAnswers.ok, false);
  assert.match(noAnswers.message, /at least one wedding detail/i);
});

test("public submission is explicit and local autosave remains notification-free", () => {
  const questionnaire = readFileSync(new URL("../../components/wedding-questionnaire.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../../app/client/wedding/submission-actions.ts", import.meta.url), "utf8");
  const autosaveStart = questionnaire.indexOf("const savePublicDraft");
  const autosaveEnd = questionnaire.indexOf("const sectionCompletion", autosaveStart);
  assert.doesNotMatch(questionnaire.slice(autosaveStart, autosaveEnd), /submitPublicWeddingHeroPlanAction/);
  assert.match(questionnaire, /Send plan now/);
  assert.match(questionnaire, /Autosave does not notify EVENTSible/);
  assert.match(action, /sendWeddingHeroOwnerNotification/);
  assert.match(action, /planning\.submitted/);
  assert.match(action, /status: "submitted"/);
  assert.match(action, /starts_at: null/);
  assert.match(action, /wedding_date_from_planner: eventDate/);
});

test("blank processional additional details stay compact in every planner mode", () => {
  const structuredFields = readFileSync(new URL("../../components/wedding-structured-fields.tsx", import.meta.url), "utf8");
  assert.match(structuredFields, /open=\{additionalFields\.some/);
  assert.doesNotMatch(structuredFields, /wedding-module-additional" open=\{revealAll/);
});

test("public submission email omits an unusable private-plan link but keeps the admin link", () => {
  const config = resolveWeddingHeroNotificationConfig({
    WEDDING_HERO_NOTIFICATION_DRY_RUN: "true",
    WEDDING_HERO_SITE_URL: "https://preview.example.com",
  });
  const email = buildWeddingHeroOwnerNotification({
    kind: WEDDING_HERO_SUBMITTED_NOTIFICATION,
    context: { coupleNames: "Jordan & Casey", source: "public_planner", eventId, assignmentId, privatePlanAvailable: false },
    requestId: "public-submission",
    createdAt: "2026-08-22T12:00:00.000Z",
    config,
  });
  assert.match(email.text, /Admin plan: https:\/\/preview\.example\.com\/admin\/wedding/);
  assert.doesNotMatch(email.text, /Private plan:/);
});
