import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { activeHqNavigationId, HQ_NAVIGATION, hqContextLabel } from "../lib/hq-navigation.mjs";

test("HQ navigation registry has the approved destinations and no future placeholders", () => {
  assert.deepEqual(HQ_NAVIGATION.map(({ id, label, href, group }) => ({ id, label, href, group })), [
    { id: "today", label: "Today", href: "/admin", group: "primary" },
    { id: "calendar", label: "Calendar", href: "/admin/calendar", group: "primary" },
    { id: "gigs", label: "Gigs", href: "/admin#gig-workspace", group: "primary" },
    { id: "leads", label: "Leads", href: "/admin#lead-review", group: "primary" },
    { id: "imports", label: "Imports", href: "/admin/imports", group: "review" },
  ]);
  assert.doesNotMatch(JSON.stringify(HQ_NAVIGATION), /Contacts|Team|Equipment|Money|Content Factory|Custom Creations/);
});

test("route and anchor matching preserve active global context", () => {
  assert.equal(activeHqNavigationId("/admin"), "today");
  assert.equal(activeHqNavigationId("/admin", "#lead-review"), "leads");
  assert.equal(activeHqNavigationId("/admin", "quote-review"), "leads");
  assert.equal(activeHqNavigationId("/admin", "#gig-workspace"), "gigs");
  assert.equal(activeHqNavigationId("/admin/calendar"), "calendar");
  assert.equal(activeHqNavigationId("/admin/imports"), "imports");
  assert.equal(activeHqNavigationId("/admin/gigs/event-id"), "gigs");
  assert.equal(activeHqNavigationId("/admin/wedding/event-id"), "gigs");
  assert.equal(activeHqNavigationId("/admin/event/event-id"), "gigs");
});

test("context labels distinguish nested workspaces without adding top-level destinations", () => {
  assert.equal(hqContextLabel("/admin/gigs/event-id"), "Gig Workspace");
  assert.equal(hqContextLabel("/admin/wedding/event-id"), "Wedding Hero review");
  assert.equal(hqContextLabel("/admin/event/event-id"), "Event Hero review");
  assert.equal(hqContextLabel("/admin/imports"), "Imports");
});

test("shared shell owns protected landmarks, mobile navigation, and accessible drawer behavior", () => {
  const layout = fs.readFileSync(fileURLToPath(new URL("../app/admin/layout.tsx", import.meta.url)), "utf8");
  const shell = fs.readFileSync(fileURLToPath(new URL("../components/hq-shell.tsx", import.meta.url)), "utf8");
  const styles = fs.readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
  assert.match(layout, /auth\.getUser\(\)/);
  assert.match(layout, /isStaffRole\(role\)/);
  assert.match(layout, /<HqShell role=/);
  assert.match(shell, /href="#hq-main-content"/);
  assert.match(shell, /id="hq-main-content"/);
  assert.match(shell, /aria-label="HQ primary navigation"/);
  assert.match(shell, /aria-label="HQ mobile navigation"/);
  assert.match(shell, /HQ_NAVIGATION\.filter/);
  assert.match(shell, /More/);
  assert.match(shell, /role="dialog"/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /lastTriggerRef\.current\?\.focus\(\)/);
  assert.match(shell, /setHash\(navigationHash\(item\.href\)\)/);
  assert.match(styles, /grid-template-columns:\s*240px minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 1099px\)/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /min-height:\s*56px/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("ordinary admin pages no longer render page-specific sidebars", () => {
  for (const relativePath of [
    "../app/admin/page.tsx",
    "../app/admin/calendar/page.tsx",
    "../app/admin/imports/page.tsx",
    "../app/admin/gigs/[eventId]/page.tsx",
    "../app/admin/wedding/[eventId]/page.tsx",
    "../app/admin/event/[eventId]/page.tsx",
  ]) {
    const source = fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
    assert.doesNotMatch(source, /className="sidebar"|className="admin-shell|className="review-nav"|className="workspace-shell/);
  }
});

test("Gig Workspace quick actions remain in normal flow beneath the shared shell", () => {
  const styles = fs.readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
  const quickActionsRule = styles.match(/\.event-day-actions\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.doesNotMatch(quickActionsRule, /position:\s*(?:sticky|fixed)/);
  assert.doesNotMatch(styles, /\.hq-main-content \.event-day-actions\s*\{[^}]*top:/);
  assert.match(styles, /\.event-day-actions \.btn\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/);
});
