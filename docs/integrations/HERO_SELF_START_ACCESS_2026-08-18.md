# Hero Self-Start Access

Date: 2026-08-18

## Decision

Wedding Hero, the Interactive Wedding Companion, and Event Hero use a verified-email self-start model. A person does not need a pre-existing EVENTSible OS booking or membership before beginning.

This covers three client situations:

- a potential client planning before booking;
- a legacy client booked through GigSalad or another external channel;
- a client already connected to an EVENTSible OS event.

## Client flow

1. The person opens `/client/login` and requests a magic link.
2. Supabase Auth verifies the email and may create the authenticated user.
3. `/client` shows any connected Hero workspaces plus permanent self-start cards for Wedding Hero and Event Hero.
4. `/client/start/wedding` or `/client/start/event` collects a small event setup record.
5. The server action creates or links the OS contact, creates an inquiry event and lead, grants client membership, and assigns the published Hero template.
6. The client is redirected into the protected planning form.

## Booking authority

A client may declare that the event was already booked, including a legacy GigSalad booking. That declaration is stored in event and planning metadata for staff review. The event remains `inquiry` until EVENTSible confirms the booking in Mission Control.

This prevents a public user from granting themselves official booked status while still removing the membership dead end.

## Privacy boundary

- Existing event data remains visible only to active event members and approved staff.
- There is no public event lookup by email, name, or URL token.
- Canonical OS records are created only after an authenticated email session is established.
- All server actions re-check authentication and membership; rendering a form is not treated as authorization.

## Staff flow

Self-starts create an active OS lead and appear in both Lead Review and the Hero Workspaces panel in Mission Control. Staff can open the complete Wedding Hero or Event Hero answer summary from the canonical event record.
