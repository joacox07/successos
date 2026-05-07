import { WASocket } from '@whiskeysockets/baileys';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { getCalendarTokens, upsertCalendarTokens } from '../db/repository.js';
import { getAuthUrl, listEvents, createEvent, deleteEvent, searchEvents, CalendarEvent } from './gcal.js';
import { extractCalendarIntent, mightBeCalendarIntent, CalendarIntent } from './extractor.js';
import { sendText } from '../whatsapp/sender.js';
import { getTodayDate } from '../utils/dates.js';

/**
 * Check if a message is calendar-related and handle it.
 * Returns the response string if handled, or null if not a calendar message.
 */
export async function handleCalendarMessage(
  userId: number,
  text: string,
  sock: WASocket,
  jid: string,
): Promise<string | null> {
  // Quick keyword check before calling AI
  if (!mightBeCalendarIntent(text)) return null;

  // Check if Google Calendar is configured
  if (!config.googleClientId || !config.googleClientSecret) {
    logger.warn('Google Calendar not configured (missing GOOGLE_CLIENT_ID/SECRET)');
    return null;
  }

  // Extract calendar intent via AI
  const intent = await extractCalendarIntent(text);
  if (intent.action === 'none') return null;

  // Check if user has calendar tokens
  const tokens = await getCalendarTokens(userId);
  if (!tokens) {
    // User hasn't connected Google Calendar yet — send auth link
    const authUrl = getAuthUrl(userId);
    return `Para usar el calendario, primero tenés que conectar tu cuenta de Google.\n\nAbrí este link:\n${authUrl}`;
  }

  try {
    switch (intent.action) {
      case 'list':
        return await handleList(tokens, intent);

      case 'create':
        return await handleCreate(tokens, intent);

      case 'delete':
        return await handleDelete(tokens, intent);

      case 'search':
        return await handleSearch(tokens, intent);

      default:
        return null;
    }
  } catch (err: any) {
    logger.error({ err, intent }, 'Calendar action failed');

    // If token expired / revoked, prompt re-auth
    if (err?.response?.status === 401 || err?.code === 401) {
      const authUrl = getAuthUrl(userId);
      return `Tu acceso a Google Calendar expiró. Reconectá tu cuenta:\n${authUrl}`;
    }

    return 'Hubo un error con el calendario. Intentá de nuevo en un rato.';
  }
}

// ── Action handlers ──

async function handleList(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  intent: CalendarIntent,
): Promise<string> {
  let timeMin: string | undefined;
  let timeMax: string | undefined;

  if (intent.date) {
    const d = new Date(intent.date + 'T00:00:00');
    timeMin = d.toISOString();
    d.setDate(d.getDate() + 1);
    timeMax = d.toISOString();
  }

  const events = await listEvents(tokens, timeMin, timeMax);

  if (events.length === 0) {
    const dateLabel = intent.date || 'hoy';
    return `No tenés eventos para ${dateLabel} 📅`;
  }

  const lines = events.map((e, i) => {
    const time = formatEventTime(e);
    return `${i + 1}. ${time} — *${e.summary}*`;
  });

  const dateLabel = intent.date || 'hoy';
  return `📅 *Agenda ${dateLabel}:*\n\n${lines.join('\n')}`;
}

async function handleCreate(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  intent: CalendarIntent,
): Promise<string> {
  if (!intent.summary) {
    return '¿Qué evento querés agendar? Decime el título, fecha y hora.';
  }

  const date = intent.date || getTodayDate();
  let startIso: string;

  if (intent.time) {
    startIso = `${date}T${intent.time}:00`;
  } else {
    startIso = date; // all-day if no time
  }

  let endIso: string | undefined;
  if (intent.endTime) {
    endIso = `${date}T${intent.endTime}:00`;
  } else if (intent.duration && intent.time) {
    const start = new Date(`${date}T${intent.time}:00`);
    start.setMinutes(start.getMinutes() + intent.duration);
    endIso = start.toISOString();
  }

  const created = await createEvent(tokens, {
    summary: intent.summary,
    description: intent.description || undefined,
    start: startIso,
    end: endIso,
    allDay: !intent.time,
  });

  const timeStr = intent.time ? ` a las ${intent.time}` : '';
  return `Agendado ✓ *${created.summary}* el ${date}${timeStr}`;
}

async function handleDelete(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  intent: CalendarIntent,
): Promise<string> {
  // If user specified an event by search or index
  if (intent.searchQuery) {
    const results = await searchEvents(tokens, intent.searchQuery);
    if (results.length === 0) {
      return `No encontré ningún evento con "${intent.searchQuery}" 🤷`;
    }

    const idx = (intent.eventIndex || 1) - 1;
    const target = results[idx] || results[0];

    if (!target.id) return 'No pude identificar el evento para borrar.';

    await deleteEvent(tokens, target.id);
    return `Borrado ✓ *${target.summary}*`;
  }

  // If no search query but has a date, list events for that date and delete by index
  if (intent.date) {
    const d = new Date(intent.date + 'T00:00:00');
    const timeMin = d.toISOString();
    d.setDate(d.getDate() + 1);
    const timeMax = d.toISOString();

    const events = await listEvents(tokens, timeMin, timeMax);
    if (events.length === 0) return 'No hay eventos para borrar en esa fecha.';

    const idx = (intent.eventIndex || 1) - 1;
    const target = events[idx];
    if (!target?.id) return 'No pude identificar el evento. Decime cuál querés borrar.';

    await deleteEvent(tokens, target.id);
    return `Borrado ✓ *${target.summary}*`;
  }

  // If user said "borrá el evento #N" referring to a previous list
  if (intent.summary) {
    const results = await searchEvents(tokens, intent.summary);
    if (results.length === 0) return `No encontré "${intent.summary}" en tu calendario.`;

    const target = results[0];
    if (!target.id) return 'No pude identificar el evento.';

    await deleteEvent(tokens, target.id);
    return `Borrado ✓ *${target.summary}*`;
  }

  return '¿Qué evento querés borrar? Decime el nombre o el número de la lista.';
}

async function handleSearch(
  tokens: { accessToken: string; refreshToken?: string | null; expiryDate?: string | null },
  intent: CalendarIntent,
): Promise<string> {
  const query = intent.searchQuery || intent.summary || '';
  if (!query) return '¿Qué evento buscás?';

  const results = await searchEvents(tokens, query);
  if (results.length === 0) return `No encontré nada con "${query}" 🤷`;

  const lines = results.map((e, i) => {
    const time = formatEventTime(e);
    return `${i + 1}. ${time} — *${e.summary}*`;
  });

  return `🔍 Resultados para "${query}":\n\n${lines.join('\n')}`;
}

// ── Helpers ──

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'Todo el día';

  try {
    const start = new Date(event.start);
    const hours = start.getHours().toString().padStart(2, '0');
    const mins = start.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  } catch {
    return event.start;
  }
}
