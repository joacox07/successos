import { google, calendar_v3 } from 'googleapis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const OAuth2 = google.auth.OAuth2;

export function getOAuth2Client() {
  return new OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

/** Generate the URL users visit to authorize Google Calendar access. */
export function getAuthUrl(userId: number): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: String(userId),
  });
}

/** Exchange the authorization code for tokens. */
export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  logger.info({ redirectUri: config.googleRedirectUri, clientId: config.googleClientId?.slice(0, 20) + '...' }, 'Exchanging code for tokens');
  try {
    const { tokens } = await client.getToken(code);
    return tokens;
  } catch (err: any) {
    // Log the full error details from Google
    const details = err?.response?.data || err?.message || err;
    logger.error({ details, code: code.slice(0, 20) + '...' }, 'Token exchange failed');
    throw err;
  }
}

/** Build an authenticated Calendar client from stored tokens. */
function getCalendar(tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null }): calendar_v3.Calendar {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || undefined,
    expiry_date: tokens.expiryDate ? Number(tokens.expiryDate) : undefined,
  });

  // Auto-refresh: when tokens refresh, we'll handle saving in the caller
  return google.calendar({ version: 'v3', auth: client });
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime or YYYY-MM-DD
  end?: string;
  allDay?: boolean;
}

/** List events for a date range. Defaults to today. */
export async function listEvents(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  timeMin?: string,
  timeMax?: string,
  maxResults = 10,
): Promise<CalendarEvent[]> {
  const cal = getCalendar(tokens);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const res = await cal.events.list({
    calendarId: 'primary',
    timeMin: timeMin || todayStart.toISOString(),
    timeMax: timeMax || todayEnd.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items || []).map((e) => ({
    id: e.id || undefined,
    summary: e.summary || '(sin título)',
    description: e.description || undefined,
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || undefined,
    allDay: !!e.start?.date,
  }));
}

/** Create a new calendar event. */
export async function createEvent(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  event: CalendarEvent,
): Promise<CalendarEvent> {
  const cal = getCalendar(tokens);

  const body: calendar_v3.Schema$Event = {
    summary: event.summary,
    description: event.description,
  };

  if (event.allDay) {
    // All-day event: use date (YYYY-MM-DD)
    const dateStr = event.start.slice(0, 10);
    body.start = { date: dateStr };
    body.end = { date: event.end?.slice(0, 10) || dateStr };
  } else {
    // Timed event
    const startDt = new Date(event.start);
    const endDt = event.end ? new Date(event.end) : new Date(startDt.getTime() + 60 * 60 * 1000); // default 1hr
    body.start = { dateTime: startDt.toISOString(), timeZone: config.timezone };
    body.end = { dateTime: endDt.toISOString(), timeZone: config.timezone };
  }

  const res = await cal.events.insert({ calendarId: 'primary', requestBody: body });

  logger.info({ eventId: res.data.id, summary: event.summary }, 'Calendar event created');
  return {
    id: res.data.id || undefined,
    summary: res.data.summary || event.summary,
    start: res.data.start?.dateTime || res.data.start?.date || event.start,
    end: res.data.end?.dateTime || res.data.end?.date || undefined,
  };
}

/** Delete a calendar event by ID. */
export async function deleteEvent(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  eventId: string,
): Promise<void> {
  const cal = getCalendar(tokens);
  await cal.events.delete({ calendarId: 'primary', eventId });
  logger.info({ eventId }, 'Calendar event deleted');
}

/** Update a calendar event by ID. */
export async function updateEvent(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  eventId: string,
  event: CalendarEvent,
): Promise<CalendarEvent> {
  const cal = getCalendar(tokens);

  const body: calendar_v3.Schema$Event = {
    summary: event.summary,
    description: event.description,
  };

  if (event.allDay) {
    const dateStr = event.start.slice(0, 10);
    body.start = { date: dateStr };
    body.end = { date: event.end?.slice(0, 10) || dateStr };
  } else {
    const startDt = new Date(event.start);
    const endDt = event.end ? new Date(event.end) : new Date(startDt.getTime() + 60 * 60 * 1000);
    body.start = { dateTime: startDt.toISOString(), timeZone: config.timezone };
    body.end = { dateTime: endDt.toISOString(), timeZone: config.timezone };
  }

  const res = await cal.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: body,
  });

  return {
    id: res.data.id || eventId,
    summary: res.data.summary || event.summary,
    description: res.data.description || event.description,
    start: res.data.start?.dateTime || res.data.start?.date || event.start,
    end: res.data.end?.dateTime || res.data.end?.date || event.end,
    allDay: !!res.data.start?.date,
  };
}

/** Search events by text query. */
export async function searchEvents(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  query: string,
  timeMin?: string,
  maxResults = 5,
): Promise<CalendarEvent[]> {
  const cal = getCalendar(tokens);

  const res = await cal.events.list({
    calendarId: 'primary',
    q: query,
    timeMin: timeMin || new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items || []).map((e) => ({
    id: e.id || undefined,
    summary: e.summary || '(sin título)',
    description: e.description || undefined,
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || undefined,
    allDay: !!e.start?.date,
  }));
}
