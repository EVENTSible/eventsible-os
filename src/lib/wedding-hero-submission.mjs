import {
  answerHasValue,
  normalizeWeddingAnswer,
  weddingProgress,
  weddingQuestionMap,
} from "./wedding-companion.mjs";
import { isWeddingHeroEmail, isWeddingHeroPhone } from "./wedding-hero-contact.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBMISSION_MODES = new Set(["guided", "form", "print"]);
const MAX_ANSWER_BYTES = 300_000;

function cleanText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}
export function validateWeddingHeroPlanSubmission(input = {}) {
  if (cleanText(input.company, 160)) {
    return { ok: false, blocked: true, message: "This submission could not be accepted." };
  }

  const draftId = cleanText(input.draftId, 80);
  const submissionId = cleanText(input.submissionId, 80);
  const contactName = cleanText(input.contactName, 160);
  const email = cleanText(input.email, 254).toLowerCase();
  const phone = cleanText(input.phone, 40);
  const mode = SUBMISSION_MODES.has(input.mode) ? input.mode : "form";
  const sectionKey = cleanText(input.sectionKey, 80) || "event_basics";
  const rawAnswers = input.answers && typeof input.answers === "object" && !Array.isArray(input.answers)
    ? input.answers
    : {};
  const errors = {};

  if (!UUID_PATTERN.test(draftId) || !UUID_PATTERN.test(submissionId)) errors.plan = "This device draft could not be identified. Refresh and try again.";
  if (contactName.length < 2) errors.contactName = "Enter the best name for EVENTSible to use.";
  if (email && !isWeddingHeroEmail(email)) errors.email = "Enter a valid email address.";
  if (phone && !isWeddingHeroPhone(phone)) errors.phone = "Enter a valid phone number.";
  if (!email && !phone) errors.contact = "Add an email address or phone number so EVENTSible can follow up.";

  let serialized = "";
  try {
    serialized = JSON.stringify(rawAnswers);
  } catch {
    errors.plan = "The planner answers could not be read. Refresh and try again.";
  }
  if (serialized.length > MAX_ANSWER_BYTES) errors.plan = "This plan is too large to submit. Contact EVENTSible for help.";

  const questionMap = weddingQuestionMap();
  const answers = Object.fromEntries(
    Object.entries(rawAnswers)
      .filter(([key]) => questionMap.has(key))
      .map(([key, value]) => [key, normalizeWeddingAnswer(questionMap.get(key), value)])
      .filter(([, value]) => answerHasValue(value)),
  );
  if (!Object.keys(answers).length) errors.plan = "Add at least one wedding detail before sending your plan.";

  if (Object.keys(errors).length) {
    return { ok: false, blocked: false, message: Object.values(errors)[0], errors };
  }

  return {
    ok: true,
    data: {
      draftId,
      submissionId,
      contactName,
      email: email || null,
      phone: phone || null,
      mode,
      sectionKey,
      answers,
      progress: weddingProgress(answers),
    },
  };
}
