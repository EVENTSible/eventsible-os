# EVENTSible OS Admin Setup

## Supabase project

- Project name: `EVENTSible OS`
- Project reference: `cplpbzudjprzbnzocirc`
- Region: `us-east-2`
- Owner login: `thepartys@eventsible.info`

## Required environment variables

Set these in local development and in Vercel for Preview and Production:

```text
NEXT_PUBLIC_SUPABASE_URL=https://cplpbzudjprzbnzocirc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<copy the active publishable key from Supabase>
```

The publishable key is designed for browser applications. Never add the service-role key to a browser or commit it to source control.

## Supabase Auth URL configuration

After the first Vercel deployment, open Supabase:

1. Authentication → URL Configuration
2. Set the production Site URL to `https://admin.eventsible.info`
3. Add the deployed preview callback URL during testing
4. Add `https://admin.eventsible.info/auth/callback` as an allowed redirect

The login form uses passwordless email magic links and does not create unapproved users.

## Vercel deployment

1. Import `EVENTSible/eventsible-os` into Vercel.
2. Add both environment variables above for Preview and Production.
3. Deploy a Preview build and test `/api/health`, `/login`, and the protected `/admin` route.
4. Connect `admin.eventsible.info` after Preview QA.

## Validation commands

```bash
npm install
npm run lint
npm run build
```

## Current capabilities

- Passwordless owner/staff sign-in
- Owner-role route protection
- Live dashboard query through `os_event_dashboard_v`
- GigTracker summary and empty states
- Wedding Hero and Event Hero progress summary
- Automation status overview
