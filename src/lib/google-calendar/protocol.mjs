import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export class GoogleCalendarError extends Error {
  constructor(code) { super(code); this.name = 'GoogleCalendarError'; this.code = code; }
}

function keyFromBase64(value) {
  const key = Buffer.from(value ?? '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new GoogleCalendarError('encryption_not_configured');
  return key;
}

export function sealRefreshToken(token, keyBase64) {
  if (typeof token !== 'string' || !token) throw new GoogleCalendarError('missing_refresh_token');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromBase64(keyBase64), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function openRefreshToken(sealed, keyBase64) {
  const [version, ivText, tagText, ciphertext, extra] = String(sealed ?? '').split('.');
  if (version !== 'v1' || extra !== undefined || !ivText || !tagText || !ciphertext) throw new GoogleCalendarError('invalid_token_envelope');
  try {
    const iv = Buffer.from(ivText, 'base64url');
    const tag = Buffer.from(tagText, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw Error('invalid envelope');
    const decipher = createDecipheriv('aes-256-gcm', keyFromBase64(keyBase64), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch { throw new GoogleCalendarError('token_decryption_failed'); }
}

export function shapeGoogleEvent(event, calendarId, ownerUserId, generation, calendarTimezone) {
  if (!event || typeof event.id !== 'string' || !event.id || event.id.length > 1024) return null;
  const status = ['confirmed','tentative','cancelled'].includes(event.status) ? event.status : 'confirmed';
  const allDay = Boolean(event.start?.date && event.end?.date);
  const startsAt = allDay ? null : event.start?.dateTime ?? null;
  const endsAt = allDay ? null : event.end?.dateTime ?? null;
  const startsOn = allDay ? event.start.date : null;
  const endsOn = allDay ? event.end.date : null;
  if (status !== 'cancelled' && (allDay ? !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || endsOn <= startsOn : !startsAt || !endsAt || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt))) return null;
  const privateEntry = ['private','confidential'].includes(event.visibility);
  const truncate = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : null;
  return {
    owner_user_id: ownerUserId, calendar_id: calendarId, event_id: event.id,
    title: privateEntry ? 'Busy' : truncate(event.summary, 300) || 'Busy',
    location: privateEntry ? null : truncate(event.location, 500),
    description: privateEntry ? null : truncate(event.description, 1000),
    starts_at: startsAt, ends_at: endsAt, starts_on: startsOn, ends_on: endsOn,
    timezone: truncate(event.start?.timeZone || calendarTimezone, 100), all_day: allDay,
    status, visibility: ['default','public','private','confidential'].includes(event.visibility) ? event.visibility : 'default',
    recurring_event_id: truncate(event.recurringEventId, 1024),
    original_start: truncate(event.originalStartTime?.dateTime || event.originalStartTime?.date, 100),
    source_updated_at: Number.isFinite(Date.parse(event.updated)) ? event.updated : null,
    generation,
  };
}

async function googleJson(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000), cache: 'no-store' }); }
  catch { throw new GoogleCalendarError('provider_unavailable'); }
  if (response.status === 410) throw new GoogleCalendarError('sync_token_expired');
  if (response.status === 400 && new URL(String(url)).pathname === '/token') {
    const body = await response.json().catch(() => ({}));
    if (body.error === 'invalid_grant') throw new GoogleCalendarError('reauthorize');
  }
  if (response.status === 401 || response.status === 403) throw new GoogleCalendarError('reauthorize');
  if (response.status === 429) throw new GoogleCalendarError('rate_limited');
  if (!response.ok) throw new GoogleCalendarError('provider_error');
  return response.json();
}

export async function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const body = new URLSearchParams({ code, client_id:clientId, client_secret:clientSecret, redirect_uri:redirectUri, grant_type:'authorization_code' });
  return googleJson('https://oauth2.googleapis.com/token', { method:'POST', body });
}

export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const body = new URLSearchParams({ refresh_token:refreshToken, client_id:clientId, client_secret:clientSecret, grant_type:'refresh_token' });
  return googleJson('https://oauth2.googleapis.com/token', { method:'POST', body });
}

export async function listGoogleCalendars(accessToken) {
  const result = [];
  let pageToken;
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    url.searchParams.set('maxResults','250');
    if (pageToken) url.searchParams.set('pageToken',pageToken);
    const data = await googleJson(url, { headers: { Authorization:`Bearer ${accessToken}` } });
    result.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) return result;
  }
  throw new GoogleCalendarError('calendar_limit');
}

export async function listGoogleEvents(accessToken, calendarId, syncToken) {
  const result = [];
  let pageToken;
  for (let page = 0; page < 12; page++) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('maxResults','250');
    url.searchParams.set('singleEvents','true');
    url.searchParams.set('showDeleted','true');
    if (syncToken) url.searchParams.set('syncToken',syncToken);
    if (pageToken) url.searchParams.set('pageToken',pageToken);
    const data = await googleJson(url, { headers: { Authorization:`Bearer ${accessToken}` } });
    result.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) {
      if (!data.nextSyncToken) throw new GoogleCalendarError('missing_sync_token');
      return { events:result, syncToken:data.nextSyncToken };
    }
  }
  throw new GoogleCalendarError('event_limit');
}
