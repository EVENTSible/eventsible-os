# EVENTSible HQ Shared Application Shell

- Status: IMPLEMENTED / PREVIEW VERIFIED
- Owner: EVENTSible OS
- Scope: protected staff HQ presentation and navigation only
- Production data or schema impact: none

## Purpose

The shared HQ shell makes the existing protected admin routes feel like one operating workspace. It centralizes global navigation and removes the independent navigation blocks that previously preceded Mission Control, Calendar, Import Review, Gig Workspace, and staff Hero review content.

The shell does not change the data queries, workflows, mutations, readiness rules, calendar classification, GigSalad sync, or Hero planning behavior owned by those routes.

## Route and navigation contract

The centralized registry exposes only implemented destinations:

| Navigation item | Destination | Active context |
| --- | --- | --- |
| Today | `/admin` | Mission Control without a contextual anchor |
| Calendar | `/admin/calendar` | Calendar and Date Book |
| Gigs | `/admin#gig-workspace` | Booked Gigs plus nested Gig and staff Hero review routes |
| Leads | `/admin#lead-review` | Lead and quote review anchors |
| Imports | `/admin/imports` | Existing Gig Intake, Import Review, and source sync controls |

Gigs and Leads intentionally remain canonical Mission Control anchors. Dedicated list routes are deferred until their data composition can be moved without duplicating query or business logic.

## Responsive shell

- Desktop (`1100px` and wider): a `240px` persistent left sidebar and compact sticky context header.
- Tablet (`768px` through `1099px`): the sidebar becomes a keyboard-operable slide-out navigation drawer opened from the header.
- Mobile (below `768px`): Today, Calendar, Gigs, Leads, and More appear in a safe-area-aware fixed bottom bar. More opens the same accessible navigation surface and exposes Imports plus current account utilities.

Content reserves space for the mobile bar. The shell does not use page-level horizontal scrolling.

## Accessibility contract

- A skip link targets the shared main landmark.
- Sidebar, header, navigation, and main content use explicit landmarks and accessible labels.
- Current navigation uses `aria-current`, stronger type, background, and a physical marker rather than color alone.
- Navigation and dismissal controls provide at least a practical `44px` target.
- The tablet/mobile dialog traps keyboard focus, closes with Escape or its close controls, and returns focus to the button that opened it.
- Focus indicators remain visible and shell motion honors `prefers-reduced-motion`.

## Deliberate exclusions

This phase does not include Mission Control rearrangement, the proposed Gig Workspace view architecture, Event-Day mode, dedicated Gigs or Leads query routes, future navigation placeholders, import-count polling, Auth changes, or any schema/data mutation.

The next independently approved phase may refresh Mission Control inside this stable shell without changing the global navigation contract.
