const STAFF_ROOT = "/admin";
const PASSWORD_UPDATE_PATH = "/login/update-password";

export function safeStaffNext(value, fallback = STAFF_ROOT) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const isHqPath = trimmed === STAFF_ROOT || trimmed.startsWith(`${STAFF_ROOT}/`);
  return isHqPath && !trimmed.startsWith("//") ? trimmed : fallback;
}

export function safeAuthCallbackNext(value) {
  if (value === PASSWORD_UPDATE_PATH) return PASSWORD_UPDATE_PATH;
  return safeStaffNext(value, null);
}

export function staffLoginNotice(error, notice) {
  if (notice === "password-updated") return "Password updated. Sign in with your new password.";
  if (error === "auth") return "Sign-in could not be completed. Try again.";
  return "";
}

export function recoveryNotice(error) {
  if (error === "recovery") return "That password setup link is invalid or expired. Request a new one.";
  return "";
}

export const STAFF_PASSWORD_MIN_LENGTH = 12;
