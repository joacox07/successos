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
  getUserDefaultCheckinDayMode,
  getPendingHabitMinutesState,
  upsertPendingHabitMinutesState,
  deletePendingHabitMinutesState,
} from '../db/repository.js';
import { extractData } from '../ai/extractor.js';
import { generateCoachResponse } from '../ai/coach.js';
import { trackExtraction } from '../engine/tracker.js';
import { processRecalibration } from '../engine/recalibration.js';
import { STATUS_PROMPT } from '../ai/prompts.js';
import { assertEditableDate, getTodayDate, normalizeDateKey, parseDateKey, resolveTargetDateFromText } from '../utils/dates.js';

const RECALIBRATION_KEYWORDS = [
  'cambiar objetivo', 'cambiar meta', 'ajustar objetivo', 'ajustar meta',
  'pausar objetivo', 'pausar meta', 'nuevo objetivo', 'nueva meta',
  'agregar objetivo', 'completÃ© el objetivo', 'completÃ© mi objetivo',
  'quiero cambiar', 'subir la meta', 'bajar la meta',
];

const STATUS_KEYWORDS = ['como vengo', 'cÃ³mo vengo', 'status', 'resumen', 'estado', 'como voy', 'cÃ³mo voy', 'progreso'];
const HELP_KEYWORDS = ['ayuda', 'help', 'comandos', 'quÃ© puedo hacer', 'que puedo hacer'];

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

const PENDING_HABIT_MINUTES_TTL_MS = 2 * 60 * 60 * 1000;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHabitName(value: string) {
  return normalizeText(value);
}

function findHabitMatch(
  existingHabits: Array<{ id: number; name: string; category: string | null; isNegative?: boolean | null; targetMinutes?: number | null }>,
  habitName: string,
) {
  const target = normalizeHabitName(habitName);
  if (!target) return null;

  const exact = existingHabits.filter((habit) => normalizeHabitName(habit.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const fuzzy = existingHabits.filter((habit) => {
    const current = normalizeHabitName(habit.name);
    return current.includes(target) || target.includes(current);
  });
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

function extractDurationMinutesFromText(text: string): number | null {
  const normalized = normalizeText(text).replace(',', '.');

  const minutesMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(min|minuto|minutos)\b/);
  if (minutesMatch) {
    const value = Number(minutesMatch[1]);
    if (Number.isFinite(value) && value > 0) return Math.round(value);
  }

  const hoursMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(h|hs|hora|horas)\b/);
  if (hoursMatch) {
    const value = Number(hoursMatch[1]);
    if (Number.isFinite(value) && value > 0) return Math.round(value * 60);
  }

  if (/\b(media hora|medio hora)\b/.test(normalized)) return 30;
  if (/\b(una hora|un hora)\b/.test(normalized)) return 60;

  const bareNumber = normalized.match(/^\s*(\d{1,3})(?:\s+min(?:utos?)?)?\s*$/);
  if (bareNumber) {
    const value = Number(bareNumber[1]);
    if (value > 0 && value <= 720) return value;
  }

  return null;
}

function isStrongContextSwitch(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (isHelpRequest(normalized) || isStatusRequest(normalized)) return true;
  if (/\b(calendario|agenda|agendame|agendar|reunion|reunion|evento)\b/.test(normalized)) return true;
  if (/\b(cambiar objetivo|cambiar meta|ajustar objetivo|ajustar meta|nuevo objetivo|nueva meta)\b/.test(normalized)) return true;
  return false;
}

function isOperatorCalendarCommand(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return /\b(agenda|agendame|agendar|programa|evento|reunion|reunir)\b/.test(normalized);
}

const HELP_MESSAGE = `*SuccessOS - Comandos*

PodÃ©s escribirme lo que sea naturalmente (texto o audio) y yo extraigo los datos. AdemÃ¡s:

â€¢ *"status"* o *"cÃ³mo vengo"* - Tu progreso actual
â€¢ *"resumen"* - Resumen del dÃ­a
â€¢ *"ayuda"* - Este mensaje
â€¢ *"cambiar objetivo"* - Modificar tus metas
â€¢ *"nuevo objetivo"* - Agregar una meta nueva

ðŸ“… *Calendario:*
â€¢ *"agendame reuniÃ³n maÃ±ana a las 3pm"* - Crear evento
â€¢ *"quÃ© tengo hoy"* o *"mi agenda"* - Ver eventos
â€¢ *"borrÃ¡ la reuniÃ³n del martes"* - Eliminar evento
â€¢ *"conectar calendario"* - Vincular Google Calendar

TambiÃ©n podÃ©s mandar logs rÃ¡pidos (terminÃ¡ con $):
â€¢ "gym 1hr$" â€¢ "dormÃ­ 6hs $" â€¢ "leÃ­ 30 pag $"

Y para el resto, contame tu dÃ­a como si hablaras con un amigo.`;

export interface ProcessResult {
  response: string;
  extractedData?: unknown;
  targetDate?: string;
  type: 'help' | 'trivial' | 'status' | 'recalibration' | 'calendar' | 'quick-log' | 'full' | 'calendar-connect';
  transcription?: string;
}

function deriveImplicitContextDate(
  mode: 'today' | 'previous_day',
  timezone: string,
): string {
  const today = parseDateKey(getTodayDate(timezone));
  if (!today) return getTodayDate(timezone);
  if (mode === 'previous_day') {
    today.setUTCDate(today.getUTCDate() - 1);
  }
  return normalizeDateKey(today);
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
    const response = `Para conectar tu Google Calendar, abrÃ­ este link:\n${authUrl}`;
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
    return { response, type: 'calendar-connect' };
  }

  if (isHelpRequest(text)) {
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: HELP_MESSAGE });
    return { response: HELP_MESSAGE, type: 'help' };
  }

  if (!targetDateHint.matched && targetDateHint.ambiguous && needsRetroactiveClarification(text)) {
    const response = 'Decime si fue hoy, ayer, anteayer o hace 3 dÃ­as y lo marco en ese dÃ­a.';
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
    return { response, type: 'full' };
  }

  const defaultCheckinDayMode = await getUserDefaultCheckinDayMode(userId);
  const contextDate = targetDateHint.date || deriveImplicitContextDate(defaultCheckinDayMode, tz);

  if (contextDate) {
    try {
      assertEditableDate(contextDate, tz);
    } catch (err) {
      const response = err instanceof Error ? err.message : 'Solo podÃ©s modificar hoy y los Ãºltimos 3 dÃ­as';
      await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
      return { response, type: 'full', targetDate: contextDate };
    }
  }

  const pendingMinutesState = await getPendingHabitMinutesState(userId);
  if (pendingMinutesState) {
    const createdAtMs = new Date(pendingMinutesState.createdAt).getTime();
    const isExpired = !Number.isFinite(createdAtMs) || (Date.now() - createdAtMs) > PENDING_HABIT_MINUTES_TTL_MS;
    if (isExpired) {
      await deletePendingHabitMinutesState(userId);
    } else {
      if (isStrongContextSwitch(text)) {
        await deletePendingHabitMinutesState(userId);
        const response = 'Perfecto. DejÃ© sin efecto la carga pendiente de minutos; cuando quieras la retomamos.';
        await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
        return { response, type: 'full', targetDate: pendingMinutesState.targetDate };
      }

      const minutes = extractDurationMinutesFromText(text);
      if (!minutes || minutes <= 0) {
        const response = 'Necesito un nÃºmero de minutos para anotarlo. Ejemplo: "30" o "90 minutos".';
        await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
        return { response, type: 'full', targetDate: pendingMinutesState.targetDate };
      }

      const habitsForPending = await getUserHabits(userId);
      const pendingHabit = habitsForPending.find((habit) => habit.id === pendingMinutesState.habitId && !habit.isNegative);
      if (!pendingHabit) {
        await deletePendingHabitMinutesState(userId);
        const response = 'No encontrÃ© el hÃ¡bito pendiente para cargar minutos. Decime de nuevo quÃ© hÃ¡bito querÃ©s registrar.';
        await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
        return { response, type: 'full', targetDate: pendingMinutesState.targetDate };
      }

      const extractionFromPending = {
        targetDate: pendingMinutesState.targetDate,
        goalProgress: [],
        newHabits: [],
        habitCompletions: [
          {
            habitName: pendingHabit.name,
            status: 'positive',
            durationMinutes: minutes,
          },
        ],
      };

      try {
        await trackExtraction(userId, tz, extractionFromPending as any, inMsg.id, pendingMinutesState.targetDate);
        await deletePendingHabitMinutesState(userId);
        const response = `Listo, anotÃ© ${minutes} min en ${pendingHabit.name}.`;
        await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response, extractedData: extractionFromPending });
        return { response, extractedData: extractionFromPending, type: 'full', targetDate: pendingMinutesState.targetDate };
      } catch (err) {
        logger.error({ err, userId, habitId: pendingHabit.id }, 'Pending habit minutes tracking failed');
        const response = 'No pude guardar esos minutos ahora. ProbÃ¡ de nuevo en un momento.';
        await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
        return { response, type: 'full', targetDate: pendingMinutesState.targetDate };
      }
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

  if (isOperatorCalendarCommand(text)) {
    try {
      const { handleOperatorMessage } = await import('./assistantOperator.js');
      const operator = await handleOperatorMessage(userId, text, tz);
      if (operator.handled) {
        if (operator.response) {
          await logMessage({
            userId,
            direction: 'out',
            contentType: 'text',
            rawContent: operator.response,
            extractedData: operator.executedActions as any,
          });
        }
        return {
          response: operator.response,
          type: 'calendar',
        };
      }
    } catch (err) {
      logger.error({ err }, 'Operator calendar handling failed');
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
      response = 'No pude generar el resumen ahora. IntentÃ¡ de nuevo en un rato.';
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
      return { response: 'No entendÃ­ eso. Â¿Me lo decÃ­s de otra forma?', type: 'quick-log', targetDate: contextDate };
    }

    if (!extraction.targetDate && targetDateHint.date) extraction.targetDate = targetDateHint.date;

    try {
      await trackExtraction(userId, tz, extraction, inMsg.id, contextDate);
    } catch (err) {
      logger.error({ err }, 'Quick log tracking failed');
    }

    const confirmation = 'Anotado âœ“';
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: confirmation, extractedData: extraction });
    return { response: confirmation, extractedData: extraction, type: 'quick-log', targetDate: extraction.targetDate || contextDate };
  }

  let extraction;
  try {
    extraction = await extractData(text, goalsForExtraction, entryForContext as Record<string, unknown> | null, habitsForExtraction);
  } catch (err) {
    logger.error({ err }, 'Extraction failed');
    const fallback = 'Te escuchÃ©, lo anoto';
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: fallback });
    return { response: fallback, type: 'full', targetDate: contextDate };
  }

  if (!extraction.targetDate && targetDateHint.date) extraction.targetDate = targetDateHint.date;
  if (extraction.targetDate) {
    try {
      assertEditableDate(extraction.targetDate, tz);
    } catch (err) {
      const response = err instanceof Error ? err.message : 'Solo podÃ©s modificar hoy y los Ãºltimos 3 dÃ­as';
      await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
      return { response, extractedData: extraction, type: 'full', targetDate: extraction.targetDate };
    }
  }

  for (const completion of extraction.habitCompletions ?? []) {
    if (completion?.durationMinutes && completion.durationMinutes > 0) continue;
    const matchedHabit = findHabitMatch(existingHabits, completion.habitName);
    if (!matchedHabit || matchedHabit.isNegative || !(matchedHabit.targetMinutes && matchedHabit.targetMinutes > 0)) continue;
    await upsertPendingHabitMinutesState(userId, matchedHabit.id, extraction.targetDate || contextDate);
    const response = `Anotado ${matchedHabit.name}. Â¿CuÃ¡ntos minutos hiciste?`;
    await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response });
    return { response, extractedData: extraction, type: 'full', targetDate: extraction.targetDate || contextDate };
  }

  try {
    await trackExtraction(userId, tz, extraction, inMsg.id, contextDate);
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
    response = 'Te escuchÃ©, lo anoto. SeguÃ­ asÃ­.';
  }

  await logMessage({ userId, direction: 'out', contentType: 'text', rawContent: response, extractedData: extraction });
  return { response, extractedData: extraction, type: 'full', targetDate: extraction.targetDate || contextDate };
}


