# EVENTSible OS Admin

The first web shell for EVENTSible OS, including:

- Passwordless Supabase Auth
- Owner/staff access checks
- Live GigTracker dashboard view
- Wedding Hero and Event Hero planning summary
- Booking lifecycle and automation status

## Architecture

- [Domain + System Architecture Map](docs/DOMAIN_SYSTEM_ARCHITECTURE.md)
- [Domain Routing Sheet](docs/DOMAIN_ROUTING_SHEET.md)

## Environment

Copy `.env.example` to `.env.local` and set the EVENTSible OS Supabase URL and publishable key.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```
