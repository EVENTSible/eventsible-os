# Wedding Hero Resources

- Status: IMPLEMENTED / PREVIEW VERIFICATION REQUIRED
- Application: EVENTSible OS client-facing Wedding Hero
- Public routes: `/client/wedding/resources` and `/client/wedding/resources/[slug]`
- Data ownership: device-local draft storage for this release

## Purpose

Wedding Hero is more than the primary wedding questionnaire. The Resources area gives couples, planners, potential clients, and the EVENTSible team reusable planning tools for calls, meetings, idea development, and final coordination.

## Implemented Resources

- Wedding Planning Meeting Companion
- Wedding Budget Tracker
- Master Wedding Guest List
- Wedding Vendor Details Tracker
- Wedding Day Timeline Builder
- Personalized Wedding Vow Builder
- Wedding Song and Moment Starter Guide
- Device-based Interactive Wedding Guestbook Starter

Each resource opens without an account, saves on the current device, and provides a print or save-as-PDF action. The Meeting Companion incorporates the practical coverage of the legacy Wedding & Reception Planner, including contacts, ceremony, processional order, pronunciations, reception formalities, music, vendor coordination, venue logistics, decisions, and follow-up.

## Explicit Boundary

Device-local storage is not multi-user collaboration. The Guestbook Starter works on one device and can be printed, but shared guest links, online submissions, moderation, view/edit roles, and cross-device resource sync remain PLANNED. They require durable OS-owned records and appropriate public or membership-scoped access rules.

## Production Safety

This implementation must be verified on Vercel Preview before any Production promotion. Production promotion requires explicit authorization.
