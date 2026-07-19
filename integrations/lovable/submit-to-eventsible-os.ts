export const EVENTSIBLE_OS_INTAKE_URL =
  "https://cplpbzudjprzbnzocirc.supabase.co/functions/v1/event-builder-intake";

export type BuilderService =
  | string
  | {
      code?: string;
      name: string;
      quantity?: number;
      unit?: string;
      unit_price?: number;
      line_total?: number;
    };

export interface EventBuilderSubmission {
  contact: {
    name: string;
    email?: string;
    phone?: string;
    organization?: string;
  };
  event: {
    title?: string;
    type: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    starts_at?: string;
    ends_at?: string;
    timezone?: string;
    guest_count?: number;
  };
  venue?: {
    name?: string;
    address_1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    power_available?: boolean;
    wifi_available?: boolean;
    outdoor?: boolean;
  };
  selected_services?: BuilderService[];
  recommended_package?: unknown;
  pricing?: {
    estimated_total?: number;
    deposit_amount?: number;
    discounts?: unknown;
  };
  what_matters_most?: string[];
  age_range?: string;
  theme?: string;
  interactive_activities?: string[];
  clean_music_required?: boolean;
  music_preferences?: unknown;
  ceremony_needed?: boolean;
  ceremony_location?: string;
  venue_access_time?: string;
  inquiry_summary?: string;
  notes?: string;
}

export interface EventBuilderIntakeResult {
  ok: boolean;
  duplicate: boolean;
  submissionId: string;
}

function createSubmissionId(): string {
  return `lovable-${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Submits a completed Lovable Event Builder session to EVENTSible OS.
 *
 * Keep the returned submission ID with the builder session so retries use the
 * same ID. EVENTSible OS treats duplicate retries as successful and does not
 * create a second contact, lead, event, or quote.
 */
export async function submitEventBuilderToEventsibleOS(
  payload: EventBuilderSubmission,
  options: {
    submissionId?: string;
    formStartedAt?: number;
    honeypot?: string;
    signal?: AbortSignal;
  } = {},
): Promise<EventBuilderIntakeResult> {
  const submissionId = options.submissionId ?? createSubmissionId();

  const response = await fetch(EVENTSIBLE_OS_INTAKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      submissionId,
      formStartedAt: options.formStartedAt,
      website: options.honeypot ?? "",
      payload,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as Partial<
    EventBuilderIntakeResult & { error: string; message: string }
  >;

  if (!response.ok) {
    throw new Error(
      result.message || result.error || `EVENTSible OS intake failed (${response.status})`,
    );
  }

  return {
    ok: result.ok === true,
    duplicate: result.duplicate === true,
    submissionId: result.submissionId ?? submissionId,
  };
}
