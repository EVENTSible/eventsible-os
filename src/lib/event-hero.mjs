export const EVENT_HERO_VERSION = "event-hero-client-v1";

export function answerHasValue(value) {
  if (Array.isArray(value)) return value.some((item) => String(item ?? "").trim());
  if (typeof value === "boolean" || typeof value === "number") return true;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function normalizeEventAnswer(question, value) {
  const fieldType = question?.fieldType ?? question?.field_type;
  if (fieldType === "yes_no") {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return null;
  }
  if (fieldType === "number") {
    if (!answerHasValue(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  if (fieldType === "multi_select" || fieldType === "repeater") {
    const values = Array.isArray(value) ? value : String(value ?? "").split("\n");
    return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))].slice(0, 100);
  }
  return answerHasValue(value) ? String(value).trim().slice(0, 10000) : null;
}

export function eventHeroProgress(questions, answers) {
  const required = questions.filter((question) => question.required ?? question.is_required);
  const measured = required.length ? required : questions;
  if (!measured.length) return 0;
  const completed = measured.filter((question) => answerHasValue(answers[question.key ?? question.question_key])).length;
  return Math.round((completed / measured.length) * 100);
}

export function formatEventAnswer(question, value) {
  if (!answerHasValue(value)) return "Not answered yet";
  const fieldType = question?.fieldType ?? question?.field_type;
  if (fieldType === "yes_no") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join("\n");
  return String(value);
}
