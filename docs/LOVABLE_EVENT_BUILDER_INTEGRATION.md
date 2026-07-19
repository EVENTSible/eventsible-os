# Lovable Event Builder → EVENTSible OS

## Status

The secure intake backend is active and tested.

- Lovable project: `https://eventsible574.lovable.app`
- Intake endpoint: `https://cplpbzudjprzbnzocirc.supabase.co/functions/v1/event-builder-intake`
- Edge Function: `event-builder-intake`
- Auth mode: public intake with strict origin allow-list and one-way staging RLS
- Privileged database access is not exposed to the browser
- Duplicate submissions are idempotent by `submissionId`

## What a successful submission creates

1. Contact, deduplicated by email and then phone
2. Builder submission record
3. Inquiry event
4. New lead
5. Optional draft quote when pricing or selected services are present
6. Quote items for selected services
7. Builder facts for Wedding Hero or Event Hero prefill
8. Activity and automation event: `builder.submission_received`

A confirmed booking later continues through the existing workflow:

`booking confirmed → client membership → Wedding Hero/Event Hero → message thread → portal ready → welcome automation`

## Production validation

A synthetic wedding submission returned HTTP `201` and created:

- one contact
- one Builder submission with status `lead_created`
- one wedding inquiry event
- one new lead
- one draft quote
- two quote items
- sixteen Builder facts
- one `builder.submission_received` automation job

The event was correctly converted from `4:00 PM–10:00 PM America/Indiana/Indianapolis` to UTC.

Submitting the same `submissionId` again returned HTTP `200` with `duplicate: true` and created no duplicate records.

All test records were deleted after validation.

## Frontend integration

Copy or adapt:

`integrations/lovable/submit-to-eventsible-os.ts`

Call `submitEventBuilderToEventsibleOS()` only after the user confirms the final Builder summary.

```ts
const result = await submitEventBuilderToEventsibleOS(builderPayload, {
  submissionId: builderSession.id,
  formStartedAt: builderSession.startedAt,
  honeypot: formValues.website,
});
```

Persist the `submissionId` in the Builder state or local storage. A retry must reuse the same ID.

## Recommended payload

```ts
{
  contact: {
    name: "Jamie & Dylan",
    email: "client@example.com",
    phone: "574-555-0100"
  },
  event: {
    title: "Jamie & Dylan Wedding",
    type: "Wedding",
    date: "2027-05-15",
    start_time: "16:00",
    end_time: "22:00",
    timezone: "America/Indiana/Indianapolis",
    guest_count: 125
  },
  venue: {
    name: "River House",
    city: "Niles",
    state: "MI",
    power_available: true,
    wifi_available: true
  },
  selected_services: [
    {
      code: "wedding_dj_mc",
      name: "Wedding DJ & MC",
      quantity: 6,
      unit: "hour",
      unit_price: 200,
      line_total: 1200
    }
  ],
  recommended_package: {
    name: "All-Inclusive Wedding",
    tier: "all_inclusive"
  },
  pricing: {
    estimated_total: 1900,
    deposit_amount: 475
  },
  what_matters_most: ["music", "guest engagement", "easy planning"],
  music_preferences: "2000s and 2010s Hip-Hop and Pop",
  clean_music_required: true,
  ceremony_needed: true,
  notes: "Additional client notes"
}
```

The endpoint also accepts many of the current flat Builder field names, including `client_name`, `client_email`, `event_type`, `event_date`, `start_time`, `venue_name`, `services`, `estimated_total`, and `deposit_amount`.

## Supported service codes

- `wedding_dj_mc`
- `dj_mc`
- `karaoke`
- `selfie_booth_digital`
- `selfie_booth_prints`
- `booth_360`
- `uplighting`
- `interactive_games`
- `kids_entertainment`
- `bartending`
- `rentals`
- `custom_creations`
- `live_performer`
- `officiant`
- `beauty_services`

Unknown services are preserved as custom draft quote items.

## Remaining frontend work

The Lovable source repository is not currently visible to the connected GitHub app. To finish the live Builder cutover:

1. Export/connect the Lovable project to GitHub.
2. Add that repository to the ChatGPT GitHub app installation.
3. Replace the current final-submit handler with the integration helper.
4. Preserve the current success/confirmation screen.
5. Display a retry-safe error if intake fails.
6. Verify the real Lovable production origin and final payload.
7. Submit one controlled test inquiry and confirm it appears in EVENTSible OS GigTracker.

Do not expose a Supabase secret or service-role key in the Lovable frontend. The only frontend credential required is none; the public Edge Function and RLS staging layer handle intake safely.
