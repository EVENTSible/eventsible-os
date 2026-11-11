export const HQ_NAVIGATION = Object.freeze([
  Object.freeze({ id: "home", label: "Home", href: "/admin", icon: "today", group: "primary" }),
  Object.freeze({ id: "gigs", label: "Gigs", href: "/admin/gigs", icon: "gigs", group: "primary" }),
  Object.freeze({ id: "calendar", label: "Calendar", href: "/admin/calendar", icon: "calendar", group: "primary" }),
  Object.freeze({ id: "team", label: "Team", href: "/admin/team", icon: "team", group: "primary" }),
  Object.freeze({ id: "tools", label: "Tools", href: "/admin/tools", icon: "tools", group: "primary" }),
  Object.freeze({ id: "mission-control", label: "Mission Control / Leads", href: "/admin/mission-control", icon: "leads", group: "review" }),
  Object.freeze({ id: "quick-add", label: "Quick Add", href: "/admin/quick-add", icon: "add", group: "review", ownerOnly: true }),
  Object.freeze({ id: "imports", label: "Imports", href: "/admin/imports", icon: "imports", group: "review" }),
  Object.freeze({ id: "data-readiness", label: "Records & Intake", href: "/admin/data-readiness", icon: "imports", group: "review", ownerOnly: true }),
  Object.freeze({ id: "site-studio", label: "Site Studio", href: "/admin/site-studio", icon: "imports", group: "review", ownerOnly: true }),
  Object.freeze({ id: "install", label: "Install HQ", href: "/admin/install", icon: "today", group: "review" }),
]);

const GIG_PATH_PREFIXES = ["/admin/gigs/", "/admin/wedding/", "/admin/event/"];

export function normalizeHqHash(hash = "") {
  if (!hash) return "";
  return hash.startsWith("#") ? hash.toLowerCase() : `#${hash.toLowerCase()}`;
}

export function activeHqNavigationId(pathname = "/admin", _hash = "") {
  const path = pathname.toLowerCase();

  if (path === "/admin/calendar" || path.startsWith("/admin/calendar/")) return "calendar";
  if (path === "/admin/team") return "team";
  if (path === "/admin/mission-control") return "mission-control";
  if (path === "/admin/quick-add" || path.startsWith("/admin/quick-add/")) return "quick-add";
  if (path === "/admin/imports" || path.startsWith("/admin/imports/")) return "imports";
  if (path === "/admin/data-readiness" || path.startsWith("/admin/data-readiness/")) return "data-readiness";
  if (path === "/admin/site-studio" || path.startsWith("/admin/site-studio/")) return "site-studio";
  if (path === "/admin/tools") return "tools";
  if (path === "/admin/install") return "install";
  if (path === "/admin/gigs") return "gigs";
  if (GIG_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return "gigs";
  return "home";
}

export function hqContextLabel(pathname = "/admin", hash = "") {
  const path = pathname.toLowerCase();
  if (path.startsWith("/admin/gigs/")) return "Gig Workspace";
  if (path.startsWith("/admin/wedding/")) return "Wedding Hero review";
  if (path.startsWith("/admin/event/")) return "Event Hero review";
  return HQ_NAVIGATION.find((item) => item.id === activeHqNavigationId(pathname, hash))?.label ?? "Home";
}
