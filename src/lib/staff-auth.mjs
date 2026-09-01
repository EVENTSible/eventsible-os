export function safeStaffNext(value, fallback = "/admin") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.startsWith("/admin") && !trimmed.startsWith("//") ? trimmed : fallback;
}

export function staffLoginNotice(error) {
  if (error === "access") return "This account is not approved for EVENTSible staff access.";
  if (error === "auth") return "That sign-in link could not be completed. Try signing in again.";
  return "";
}
