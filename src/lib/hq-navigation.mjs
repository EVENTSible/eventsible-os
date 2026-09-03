export const HQ_NAVIGATION = Object.freeze([
  Object.freeze({ id: "today", label: "Today", href: "/admin", icon: "today", group: "primary" }),
  Object.freeze({ id: "calendar", label: "Calendar", href: "/admin/calendar", icon: "calendar", group: "primary" }),
  Object.freeze({ id: "gigs", label: "Gigs", href: "/admin#gig-workspace", icon: "gigs", group: "primary" }),
  Object.freeze({ id: "leads", label: "Leads", href: "/admin#lead-review", icon: "leads", group: "primary" }),
  Object.freeze({ id: "imports", label: "Imports", href: "/admin/imports", icon: "imports", group: "review" }),
]);

const GIG_PATH_PREFIXES = ["/admin/gigs/", "/admin/wedding/", "/admin/event/"];
const GIG_HASHES = new Set(["#gig-workspace", "#hero-workspaces"]);
const LEAD_HASHES = new Set(["#lead-review", "#quote-review"]);

export function normalizeHqHash(hash = "") {
  if (!hash) return "";
  return hash.startsWith("#") ? hash.toLowerCase() : `#${hash.toLowerCase()}`;
}

export function activeHqNavigationId(pathname = "/admin", hash = "") {
  const path = pathname.toLowerCase();
  const normalizedHash = normalizeHqHash(hash);

  if (path === "/admin/calendar" || path.startsWith("/admin/calendar/")) return "calendar";
  if (path === "/admin/imports" || path.startsWith("/admin/imports/")) return "imports";
  if (GIG_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return "gigs";
  if (path === "/admin" && GIG_HASHES.has(normalizedHash)) return "gigs";
  if (path === "/admin" && LEAD_HASHES.has(normalizedHash)) return "leads";
  return "today";
}

export function hqContextLabel(pathname = "/admin", hash = "") {
  const path = pathname.toLowerCase();
  if (path.startsWith("/admin/gigs/")) return "Gig Workspace";
  if (path.startsWith("/admin/wedding/")) return "Wedding Hero review";
  if (path.startsWith("/admin/event/")) return "Event Hero review";
  return HQ_NAVIGATION.find((item) => item.id === activeHqNavigationId(pathname, hash))?.label ?? "Today";
}
