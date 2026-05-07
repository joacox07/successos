/**
 * Shared message processor used by both WhatsApp handler and Web Chat API.
 * Centralizes all message handling logic: quick logs, status, help, calendar,
 * recalibration, extraction, tracking, and coaching.
 */
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import {
  getActiveGoals,
  getTodayEntry,
  getActivePatterns,
  logMessage,
  getRecentMessagesAsc,
  getUserHabits,
} from '../db/repository.js';
import { extractData } from '../ai/extractor.js';
import { generateCoachResponse } from '../ai/coach.js';
import { trackExtraction } from '../engine/tracker.js';
import { processRecalibration } from '../engine/recalibration.js';
import { STATUS_PROMPT } from '../ai/prompts.js';
import { assertEditableDate, getTodayDate, resolveTargetDateFromText } from '../utils/dates.js';

const RECALIBRATION_KEYWORDS = [
  'cambiar objetivo', 'cambiar meta', 'ajustar objetivo', 'ajustar meta',
  'pausar objetivo', 'pausar meta', 'nuevo objetivo', 'nueva meta',
  'agregar objetivo', 'completé el objetivo', 'completé mi objetivo',
  'quiero cambiar', 'subir la meta', 'bajar la meta',
];

const STATUS_KEYWORDS = ['como vengo', 'cómo vengo', 'status', 'resumen', 'estado', 'como voy', 'cómo voy', 'progreso'];
const HELP_KEYWORDS = ['ayuda', 'help', 'comandos', 'qué puedo hacer', 'que puedo hacer'];

function isQuickLog(text: string): boolean {
  return text.trim().endsWith('$');
}

function isStatusRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return STATUS_KEYWORDS.some((kw) => lower.includes(kw));
}

function isHelpRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return HELP_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw));
}

function isTrivialMessage(text: string): boolean {
  return config.trivialPatterns.test(text.trim());
}

function needsRetroactiveClarification(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\b(me olvide|me olvide de marcar|me olvide de anotar|no marque|no tilde|corregi|corrigi|falto anotar)\b/.test(normalized);
}

const HELP_MESSAGE = `*SuccessOS - Comandos*

Podés escribirme lo que sea naturalmente (texto o audio) y yo extraigo los datos. Además:

• *"status"* o *"cómo vengo"* - Tu progreso actual
• *"resumen"* - Resumen del día
• *"ayuda"* - Este mensaje
• *"cambiar objetivo"* - Modificar tus metas
• *"nuevo objetivo"* - Agregar una meta nueva

📅 *Calendario:*
• *"agendame reunión mañana a las 3pm"* - Crear evento
• *"qué tengo hoy"* o *"mi agenda"* - Ver eventos
• *"borrá la reunión del martes"* - Eliminar evento
• *"conectar calendario"* - Vincular Google Calendar

También podés mandar logs rápidos (terminá con $):
• "gym 1hr$" • "dormí 6hs $" • "leí 30 pag $"

Y para el resto, contame tu día como si hablaras con un amigo.`;

export interface ProcessResult {
  response: string;
  extractedData?: unknown;
  targetDate?: string;
  type: 'help' | 'trivial' | 'status' | 'recalibration' | 'calendar' | 'quick-log' | 'full' | 'calendar-connect';
  transcription?: string;
}

export async function processMessage(
  userId: number,
  text: string,
  options?: {
    timezone?: string;
    contentType?: 'text' | 'audio';
    transcription?: string;
  },
): Promise<ProcessResult> {
  const tz = options?.timezone || 'America/Argentina/Buenos_Aires';
  const today = getTodayDate(tz);
  const incomingContentType = options?.contentType || 'text';
  const targetDateHint = resolveTargetDateFromText(text, tz);
  const contextDate = targetDateHint.date || today;

  const inMsg = await logMessage({
    userId,
    direction: 'in',
    contentType: incomingContentType,
    rawContent: text,
  });

  const textLowerEarly = text.toLowerCase();
  const CALENDAR_CONNECT_KEYWORDS = ['conectar calendario', 'vincular calendario', 'google calendar'];
  if (CALENDAR_CONNECT_KEYWORDS.some((kw) => textLowerEarly.includes(kw)) && config.googleClientId) {
    const { getAuthUrl } = await import('../calendar/gcal.js');
    const authUrl = getAuthUrl(userId);
    const response = `Para conectar tu Google Calendar, abrí este link:\n${authUrl}`;
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
    return { response, type: 'calendar-connect' };
  }

  if (isHelpRequest(text)) {
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: HELP_MESSAGE });
    return { response: HELP_MESSAGE, type: 'help' };
  }

  if (!targetDateHint.matched && targetDateHint.ambiguous && needsRetroactiveClarification(text)) {
    const response = 'Decime si fue hoy, ayer, anteayer o hace 3 días y lo marco en ese día.';
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
    return { response, type: 'full' };
  }

  if (targetDateHint.date) {
    try {
      assertEditableDate(targetDateHint.date, tz);
    } catch (err) {
      const response = err instanceof Error ? err.message : 'Solo podés modificar hoy y los últimos 3 días';
      await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
      return { response, type: 'full', targetDate: targetDateHint.date };
    }
  }

  if (isTrivialMessage(text)) {
    const recentMsgs = await getRecentMessagesAsc(userId, 3);
    const hasRecentConversation = recentMsgs.length > 0 && recentMsgs.some((m) => {
      const msgAge = Date.now() - new Date(m.timestamp).getTime();
      return msgAge < 30 * 60 * 1000;
    });

    if (!hasRecentConversation) {
      logger.debug({ userId, text }, 'Trivial message with no context, skipping AI');
      return { response: '', type: 'trivial' };
    }

    logger.debug({ userId, text }, 'Trivial message but has conversation context, processing');
  }

  const textLower = text.toLowerCase();
  if (RECALIBRATION_KEYWORDS.some((kw) => textLower.includes(kw))) {
    try {
      const response = await processRecalibration(userId, text);
      await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
      return { response, type: 'recalibration' };
    } catch (err) {
      logger.error({ err }, 'Recalibration failed');
    }
  }

  try {
    const { handleCalendarMessage } = await import('../calendar/handler.js');
    const calResponse = await handleCalendarMessage(userId, text, null as any, '');
    if (calResponse) {
      await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: calResponse });
      return { response: calResponse, type: 'calendar' };
    }
  } catch (err) {
    logger.error({ err }, 'Calendar handler error');
  }

  const goals = await getActiveGoals(userId);
  const entryForContext = await getTodayEntry(userId, contextDate);
  const patterns = await getActivePatterns(userId);
  const existingHabits = await getUserHabits(userId);

  const goalsForExtraction = goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    metric: g.metric,
    unit: g.unit,
  }));

  const habitsForExtraction = existingHabits.map((h) => ({
    id: h.id,
    name: h.name,
    category: h.category,
    isNegative: !!h.isNegative,
  }));

  if (isStatusRequest(text)) {
    const goalsForCoach = goals.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      unit: g.unit,
    }));
    const recentMsgs = await getRecentMessagesAsc(userId, config.conversationContextLimit);
    const history = recentMsgs.map((m) => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.rawContent || '',
    }));

    let response: string;
    try {
      response = await generateCoachResponse(
        STATUS_PROMPT,
        (entryForContext as Record<string, unknown>) || {},
        goalsForCoach,
        patterns.map((p) => ({ description: p.description })),
        history,
      );
    } catch {
      response = 'No pude generar el resumen ahora. Intentá de nuevo en un rato.';
    }

    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
    return { response, type: 'status', targetDate: contextDate };
  }

  if (isQuickLog(text)) {
    let extraction;
    try {
      extraction = await extractData(text, goalsForExtraction, entryForContext as Record<string, unknown> | null, habitsForExtraction);
    } catch (err) {
      logger.error({ err }, 'Quick log extraction failed');
      return { response: 'No entendí eso. ¿Me lo decís de otra forma?', type: 'quick-log', targetDate: contextDate };
    }

    if (!extraction.targetDate && targetDateHint.date) extraction.targetDate = targetDateHint.date;

    try {
      await trackExtraction(userId, tz, extraction, inMsg.id);
    } catch (err) {
      logger.error({ err }, 'Quick log tracking failed');
    }

    const confirmation = 'Anotado ✓';
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: confirmation, extractedData: extraction });
    return { response: confirmation, extractedData: extraction, type: 'quick-log', targetDate: extraction.targetDate || contextDate };
  }

  let extraction;
  try {
    extraction = await extractData(text, goalsForExtraction, entryForContext as Record<string, unknown> | null, habitsForExtraction);
  } catch (err) {
    logger.error({ err }, 'Extraction failed');
    const fallback = 'Te escuché, lo anoto';
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: fallback });
    return { response: fallback, type: 'full', targetDate: contextDate };
  }

  if (!extraction.targetDate && targetDateHint.date) extraction.targetDate = targetDateHint.date;
  if (extraction.targetDate) {
    try {
      assertEditableDate(extraction.targetDate, tz);
    } catch (err) {
      const response = err instanceof Error ? err.message : 'Solo podés modificar hoy y los últimos 3 días';
      await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
      return { response, extractedData: extraction, type: 'full', targetDate: extraction.targetDate };
    }
  }

  try {
    await trackExtraction(userId, tz, extraction, inMsg.id);
  } catch (err) {
    logger.error({ err }, 'Tracking failed');
  }

  const recentMsgs = await getRecentMessagesAsc(userId, config.conversationContextLimit);
  const conversationHistory = recentMsgs.map((m) => ({
    role: m.direction === 'in' ? 'user' : 'assistant',
    content: m.rawContent || '',
  }));

  const goalsForCoach = goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    currentValue: g.currentValue,
    targetValue: g.targetValue,
    unit: g.unit,
  }));

  let response: string;
  try {
    response = await generateCoachResponse(
      text,
      extraction as unknown as Record<string, unknown>,
      goalsForCoach,
      patterns.map((p) => ({ description: p.description })),
      conversationHistory,
    );
  } catch (err) {
    logger.error({ err }, 'Coach response failed');
    response = 'Te escuché, lo anoto. Seguí así.';
  }

  await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response, extractedData: extraction });
  return { response, extractedData: extraction, type: 'full', targetDate: extraction.targetDate || contextDate };
}
