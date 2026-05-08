import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import {
  actionLogs,
  dailyEntries,
  goals,
  goalLogs,
  habitLogs,
  habits,
} from '../db/schema.js';
import {
  addHabitLogMinutes,
  createGoal,
  createGoalLog,
  createHabit,
  deactivateHabit,
  getCalendarTokens,
  getGoalByIdForUser,
  getHabitByIdForUser,
  getTodayEntry,
  setHabitLogStatus,
  updateGoal,
  updateHabit,
  upsertDailyEntry,
} from '../db/repository.js';
import { assertEditableDate, getTodayDate, parseDateKey, resolveTargetDateFromText } from '../utils/dates.js';
import { createEvent, deleteEvent, listEvents, updateEvent } from '../calendar/gcal.js';

export type AssistantIntent = 'execute_action' | 'ask_clarification' | 'coach_reply';

export interface ExecutedAction {
  type: string;
  entity: string;
  summary: string;
  effectiveDate?: string;
}

export interface OperatorResult {
  intent: AssistantIntent;
  handled: boolean;
  response: string;
  executedActions: ExecutedAction[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  undoToken?: string;
  effectiveDate?: string;
}

type PlannedAction =
  | { type: 'habit.create'; data: { name: string; category?: string | null; isNegative?: boolean } }
  | { type: 'habit.update'; data: { habitId: number; name?: string; category?: string | null; isNegative?: boolean } }
  | { type: 'habit.delete'; data: { habitId: number } }
  | { type: 'habit.log'; data: { habitId: number; date: string; status?: 'positive' | 'negative' | 'clear'; minutes?: number } }
  | { type: 'checkin.update'; data: { date: string; patch: Record<string, unknown> } }
  | { type: 'goal.create'; data: { title: string; category: string; targetValue?: string | null; unit?: string | null } }
  | { type: 'goal.update'; data: { goalId: number; patch: Record<string, unknown> } }
  | { type: 'goal.progress.log'; data: { goalId: number; value: number; date: string; note?: string | null } }
  | { type: 'calendar.create'; data: { summary: string; date: string; time: string; endTime?: string } }
  | { type: 'calendar.update'; data: { eventId: string; summary?: string; date?: string; time?: string; endTime?: string } }
  | { type: 'calendar.delete'; data: { eventId: string } };

const UndoPayloadSchema = z.object({
  actionType: z.string(),
  inverse: z.record(z.any()),
});

const TEN_MINUTES_MS = 10 * 60 * 1000;

function normalizeText(input: string) {
  return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function inferIntent(text: string): AssistantIntent {
  const t = normalizeText(text);
  if (/\b(agrega|agregar|crea|crear|borra|elimina|eliminar|modifica|editar|actualiza|cambia|marcar|desmarcar|anota|suma|resta|agenda|agendame|programa)\b/.test(t)) {
    return 'execute_action';
  }
  if (/\b(status|resumen|como vengo|como voy|progreso)\b/.test(t)) {
    return 'coach_reply';
  }
  return 'coach_reply';
}

function parseTime(text: string): string | null {
  const m = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function deriveCalendarDate(text: string, timezone: string): string | null {
  const n = normalizeText(text);
  if (/\bmanana\b/.test(n)) {
    const today = parseDateKey(getTodayDate(timezone));
    if (!today) return null;
    today.setUTCDate(today.getUTCDate() + 1);
    return today.toISOString().slice(0, 10);
  }
  const hint = resolveTargetDateFromText(text, timezone);
  return hint.date;
}

function parseActionPlan(text: string, timezone: string): { action?: PlannedAction; clarification?: string } {
  const raw = text.trim();
  const n = normalizeText(raw);
  const dateHint = resolveTargetDateFromText(raw, timezone).date || getTodayDate(timezone);

  const createHabit = raw.match(/(?:agrega|crear?|nuevo)\s+(?:habito\s+)?["“]?([^"”]+?)["”]?(?:\s+(?:en|categoria)\s+([a-zA-Zñáéíóú]+))?$/i);
  if (createHabit && /\bhabito\b/i.test(raw)) {
    return {
      action: {
        type: 'habit.create',
        data: {
          name: createHabit[1].trim(),
          category: createHabit[2]?.trim().toLowerCase() || null,
          isNegative: /\b(dejar|evitar|no\s+)\b/i.test(raw),
        },
      },
    };
  }

  const deleteHabit = n.match(/\b(elimina|borra)\b.*\bhabito\b.*\b(\d+)\b/);
  if (deleteHabit) {
    if (!/\b(confirma|confirmar|si,?\s*borra|si,?\s*elimina)\b/.test(n)) {
      return { clarification: 'Confirmame si querés borrar ese hábito (respondé: "sí, borrar").' };
    }
    return { action: { type: 'habit.delete', data: { habitId: Number(deleteHabit[2]) } } };
  }

  const updateHabit = n.match(/\b(modifica|edita|actualiza|cambia)\b.*\bhabito\b.*\b(\d+)\b.*\b(?:a|por)\s+(.+)$/);
  if (updateHabit) {
    return { action: { type: 'habit.update', data: { habitId: Number(updateHabit[2]), name: updateHabit[3].trim() } } };
  }

  const logHabit = n.match(/\b(marca|anota|log)\b.*\bhabito\b.*\b(\d+)\b(?:.*\b(\d+)\s*min\b)?/);
  if (logHabit) {
    const minutes = logHabit[3] ? Number(logHabit[3]) : undefined;
    return { action: { type: 'habit.log', data: { habitId: Number(logHabit[2]), date: dateHint, minutes, status: minutes ? 'positive' : 'positive' } } };
  }

  if (/\b(checkin|check in|diario)\b/.test(n) && /\b(corregi|corrige|modifica|actualiza|cambia|editar)\b/.test(n)) {
    const patch: Record<string, unknown> = {};
    const mood = n.match(/\b(animo|mood)\s*(\d{1,2})\b/);
    if (mood) patch.mood = Math.max(1, Math.min(10, Number(mood[2])));
    const energy = n.match(/\b(energia)\s*(\d{1,2})\b/);
    if (energy) patch.energyLevel = Math.max(1, Math.min(10, Number(energy[2])));
    const focus = n.match(/\b(foco|focus)\s*(\d+(?:[.,]\d+)?)\b/);
    if (focus) patch.focusHours = Number(focus[2].replace(',', '.'));
    if (Object.keys(patch).length > 0) {
      return { action: { type: 'checkin.update', data: { date: dateHint, patch } } };
    }
  }

  const createGoal = raw.match(/(?:agrega|crea|nuevo)\s+(?:objetivo|meta)\s+["“]?([^"”]+?)["”]?(?:\s+de\s+(\d+(?:[.,]\d+)?))?(?:\s*([a-zA-Z%$]+))?/i);
  if (createGoal && /\b(objetivo|meta)\b/i.test(raw)) {
    return {
      action: {
        type: 'goal.create',
        data: {
          title: createGoal[1].trim(),
          category: 'personal',
          targetValue: createGoal[2] || null,
          unit: createGoal[3] || null,
        },
      },
    };
  }

  const updateGoal = n.match(/\b(cambia|modifica|actualiza)\b.*\b(meta|objetivo)\b.*\b(\d+)\b.*\b(?:a|por)\s+(\d+(?:[.,]\d+)?)\b/);
  if (updateGoal) {
    return { action: { type: 'goal.update', data: { goalId: Number(updateGoal[3]), patch: { targetValue: String(updateGoal[4]).replace(',', '.') } } } };
  }

  const logGoal = n.match(/\b(suma|agrega|anota)\b.*\b(progreso)\b.*\b(meta|objetivo)\b.*\b(\d+)\b.*\b(\d+(?:[.,]\d+)?)\b/);
  if (logGoal) {
    return {
      action: {
        type: 'goal.progress.log',
        data: {
          goalId: Number(logGoal[4]),
          value: Number(logGoal[5].replace(',', '.')),
          date: dateHint,
        },
      },
    };
  }

  if (/\b(agenda|agendame|programa)\b/.test(n)) {
    const date = deriveCalendarDate(raw, timezone) || getTodayDate(timezone);
    const time = parseTime(raw);
    if (!time) {
      return { clarification: 'Decime la hora exacta para agendarlo (HH:MM).' };
    }
    const summaryMatch = raw.match(/(?:agenda(?:me)?|programa)\s+(.+?)(?:\s+(?:manana|hoy|anteayer|ayer|el\s+\d{1,2}\s+de\s+\w+))?(?:\s+a\s+las|\s+\d{1,2}[:.]\d{2})/i);
    const summary = (summaryMatch?.[1] || 'Evento').trim();
    return { action: { type: 'calendar.create', data: { summary, date, time } } };
  }

  const deleteEvent = n.match(/\b(elimina|borra)\b.*\b(evento|reunion)\b.*\b(id|#)\s*([a-zA-Z0-9_-]+)\b/);
  if (deleteEvent) {
    if (!/\b(confirma|confirmar|si,?\s*borra|si,?\s*elimina)\b/.test(n)) {
      return { clarification: 'Confirmame si querés borrar ese evento (respondé: "sí, borrar").' };
    }
    return { action: { type: 'calendar.delete', data: { eventId: deleteEvent[4] } } };
  }

  return {};
}

async function createUndoLog(userId: number, actionType: string, inverse: Record<string, unknown>) {
  const db = getDb();
  const undoToken = randomUUID();
  const reversibleUntil = new Date(Date.now() + TEN_MINUTES_MS).toISOString();
  await db.insert(actionLogs).values({
    userId,
    undoToken,
    actionType,
    payload: { actionType, inverse },
    reversibleUntil,
    undone: false,
  });
  return undoToken;
}

export async function handleOperatorMessage(userId: number, text: string, timezone: string): Promise<OperatorResult> {
  const intent = inferIntent(text);
  if (intent !== 'execute_action') {
    return {
      intent,
      handled: false,
      response: '',
      executedActions: [],
      needsClarification: false,
    };
  }

  const parsed = parseActionPlan(text, timezone);
  if (parsed.clarification) {
    return {
      intent: 'ask_clarification',
      handled: true,
      response: parsed.clarification,
      executedActions: [],
      needsClarification: true,
      clarificationQuestion: parsed.clarification,
    };
  }
  if (!parsed.action) {
    return { intent: 'coach_reply', handled: false, response: '', executedActions: [], needsClarification: false };
  }

  const action = parsed.action;
  let undoToken: string | undefined;
  let effectiveDate: string | undefined;
  const executedActions: ExecutedAction[] = [];

  if (action.type === 'habit.create') {
    const habit = await createHabit({
      userId,
      name: action.data.name,
      category: action.data.category || null,
      isNegative: !!action.data.isNegative,
      frequency: 'daily',
      active: true,
    });
    undoToken = await createUndoLog(userId, action.type, { habitId: habit.id, op: 'deactivate' });
    executedActions.push({ type: action.type, entity: `habit:${habit.id}`, summary: `hábito "${habit.name}" creado` });
  }

  if (action.type === 'habit.update') {
    const prev = await getHabitByIdForUser(action.data.habitId, userId);
    if (!prev) throw new Error('No encontré ese hábito.');
    await updateHabit(action.data.habitId, {
      ...(action.data.name ? { name: action.data.name } : {}),
      ...(action.data.category !== undefined ? { category: action.data.category } : {}),
      ...(action.data.isNegative !== undefined ? { isNegative: action.data.isNegative } : {}),
    });
    undoToken = await createUndoLog(userId, action.type, { habitId: prev.id, prev });
    executedActions.push({ type: action.type, entity: `habit:${prev.id}`, summary: `hábito ${prev.id} actualizado` });
  }

  if (action.type === 'habit.delete') {
    const prev = await getHabitByIdForUser(action.data.habitId, userId);
    if (!prev) throw new Error('No encontré ese hábito.');
    await deactivateHabit(action.data.habitId);
    undoToken = await createUndoLog(userId, action.type, { habitId: prev.id, op: 'reactivate' });
    executedActions.push({ type: action.type, entity: `habit:${prev.id}`, summary: `hábito ${prev.id} desactivado` });
  }

  if (action.type === 'habit.log') {
    assertEditableDate(action.data.date, timezone);
    effectiveDate = action.data.date;
    const db = getDb();
    const [prevLog] = await db.select().from(habitLogs)
      .where(and(eq(habitLogs.habitId, action.data.habitId), eq(habitLogs.userId, userId), eq(habitLogs.date, action.data.date)))
      .limit(1);
    if (typeof action.data.minutes === 'number') {
      await addHabitLogMinutes(action.data.habitId, userId, action.data.date, action.data.minutes, 'set');
    } else {
      await setHabitLogStatus(action.data.habitId, userId, action.data.date, action.data.status || 'positive');
    }
    undoToken = await createUndoLog(userId, action.type, { habitId: action.data.habitId, date: action.data.date, prevLog: prevLog || null });
    executedActions.push({ type: action.type, entity: `habit:${action.data.habitId}`, summary: `hábito ${action.data.habitId} marcado`, effectiveDate: action.data.date });
  }

  if (action.type === 'checkin.update') {
    assertEditableDate(action.data.date, timezone);
    effectiveDate = action.data.date;
    const prev = await getTodayEntry(userId, action.data.date);
    await upsertDailyEntry(userId, action.data.date, {
      ...(action.data.patch.mood !== undefined ? { mood: Number(action.data.patch.mood) } : {}),
      ...(action.data.patch.energyLevel !== undefined ? { energyLevel: Number(action.data.patch.energyLevel) } : {}),
      ...(action.data.patch.focusHours !== undefined ? { focusHours: Number(action.data.patch.focusHours) } : {}),
    });
    undoToken = await createUndoLog(userId, action.type, { date: action.data.date, prev });
    executedActions.push({ type: action.type, entity: `checkin:${action.data.date}`, summary: `check-in actualizado`, effectiveDate: action.data.date });
  }

  if (action.type === 'goal.create') {
    const goal = await createGoal({
      userId,
      title: action.data.title,
      category: action.data.category,
      targetValue: action.data.targetValue || null,
      currentValue: '0',
      unit: action.data.unit || null,
      status: 'active',
    });
    undoToken = await createUndoLog(userId, action.type, { goalId: goal.id, op: 'pause' });
    executedActions.push({ type: action.type, entity: `goal:${goal.id}`, summary: `objetivo "${goal.title}" creado` });
  }

  if (action.type === 'goal.update') {
    const prev = await getGoalByIdForUser(action.data.goalId, userId);
    if (!prev) throw new Error('No encontré ese objetivo.');
    await updateGoal(action.data.goalId, action.data.patch);
    undoToken = await createUndoLog(userId, action.type, { goalId: prev.id, prev });
    executedActions.push({ type: action.type, entity: `goal:${prev.id}`, summary: `objetivo ${prev.id} actualizado` });
  }

  if (action.type === 'goal.progress.log') {
    assertEditableDate(action.data.date, timezone);
    effectiveDate = action.data.date;
    const prev = await getGoalByIdForUser(action.data.goalId, userId);
    if (!prev) throw new Error('No encontré ese objetivo.');
    const current = Number(prev.currentValue || '0');
    const next = current + action.data.value;
    await updateGoal(action.data.goalId, { currentValue: String(next) });
    await createGoalLog({
      goalId: action.data.goalId,
      userId,
      date: action.data.date,
      action: 'assistant_progress_log',
      valueChange: action.data.value,
      note: action.data.note || null,
    });
    undoToken = await createUndoLog(userId, action.type, { goalId: prev.id, prevCurrentValue: prev.currentValue || '0' });
    executedActions.push({ type: action.type, entity: `goal:${prev.id}`, summary: `sumé ${action.data.value} al objetivo ${prev.id}`, effectiveDate: action.data.date });
  }

  if (action.type === 'calendar.create') {
    const tokens = await getCalendarTokens(userId);
    if (!tokens) {
      return {
        intent: 'ask_clarification',
        handled: true,
        response: 'Para agendar, primero conectá Google Calendar en Agenda.',
        executedActions: [],
        needsClarification: true,
        clarificationQuestion: 'Conectá Google Calendar para continuar.',
      };
    }
    const start = `${action.data.date}T${action.data.time}:00`;
    const end = `${action.data.date}T${action.data.endTime || action.data.time}:00`;
    const created = await createEvent(tokens, { summary: action.data.summary, start, end, allDay: false });
    undoToken = await createUndoLog(userId, action.type, { eventId: created.id });
    effectiveDate = action.data.date;
    executedActions.push({ type: action.type, entity: `calendar:${created.id}`, summary: `evento "${created.summary}" agendado`, effectiveDate: action.data.date });
  }

  if (action.type === 'calendar.delete') {
    const tokens = await getCalendarTokens(userId);
    if (!tokens) throw new Error('Calendar no conectado.');
    const events = await listEvents(tokens, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), 250);
    const prev = events.find((e) => e.id === action.data.eventId);
    await deleteEvent(tokens, action.data.eventId);
    undoToken = await createUndoLog(userId, action.type, { prevEvent: prev || null });
    executedActions.push({ type: action.type, entity: `calendar:${action.data.eventId}`, summary: `evento ${action.data.eventId} eliminado` });
  }

  if (action.type === 'calendar.update') {
    const tokens = await getCalendarTokens(userId);
    if (!tokens) throw new Error('Calendar no conectado.');
    const events = await listEvents(tokens, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), 250);
    const prev = events.find((e) => e.id === action.data.eventId);
    if (!prev) throw new Error('No encontré ese evento.');
    const date = action.data.date || prev.start.slice(0, 10);
    const time = action.data.time || (prev.allDay ? '09:00' : prev.start.slice(11, 16));
    const endTime = action.data.endTime || (prev.end ? prev.end.slice(11, 16) : '10:00');
    const updated = await updateEvent(tokens, action.data.eventId, {
      summary: action.data.summary || prev.summary,
      start: `${date}T${time}:00`,
      end: `${date}T${endTime}:00`,
      allDay: false,
    });
    undoToken = await createUndoLog(userId, action.type, { eventId: action.data.eventId, prevEvent: prev });
    effectiveDate = date;
    executedActions.push({ type: action.type, entity: `calendar:${updated.id}`, summary: `evento ${updated.id} actualizado`, effectiveDate: date });
  }

  const firstSummary = executedActions[0]?.summary || 'acción ejecutada';
  return {
    intent: 'execute_action',
    handled: true,
    response: `Hecho: ${firstSummary}.`,
    executedActions,
    needsClarification: false,
    undoToken,
    effectiveDate,
  };
}

export async function undoOperatorAction(userId: number, undoToken: string): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  const [row] = await db.select().from(actionLogs)
    .where(and(eq(actionLogs.userId, userId), eq(actionLogs.undoToken, undoToken)))
    .limit(1);
  if (!row) return { ok: false, message: 'No encontré ese undo.' };
  if (row.undone) return { ok: false, message: 'Ese undo ya se usó.' };
  if (new Date(row.reversibleUntil).getTime() < Date.now()) return { ok: false, message: 'La ventana de deshacer expiró.' };

  const parsed = UndoPayloadSchema.safeParse(row.payload);
  if (!parsed.success) return { ok: false, message: 'Undo inválido.' };
  const inverse = parsed.data.inverse as Record<string, any>;

  if (parsed.data.actionType === 'habit.create' && inverse.habitId) {
    await deactivateHabit(Number(inverse.habitId));
  } else if (parsed.data.actionType === 'habit.update' && inverse.prev) {
    await updateHabit(Number(inverse.habitId || inverse.prev.id), {
      name: inverse.prev.name,
      category: inverse.prev.category,
      isNegative: !!inverse.prev.isNegative,
    });
  } else if (parsed.data.actionType === 'habit.delete' && inverse.habitId) {
    await updateHabit(Number(inverse.habitId), { active: true });
  } else if (parsed.data.actionType === 'habit.log') {
    const habitId = Number(inverse.habitId);
    const date = String(inverse.date);
    const prevLog = inverse.prevLog;
    if (!prevLog) {
      await setHabitLogStatus(habitId, userId, date, 'clear');
    } else if (typeof prevLog.minutesLogged === 'number' && prevLog.minutesLogged > 0) {
      await addHabitLogMinutes(habitId, userId, date, Number(prevLog.minutesLogged), 'set');
    } else {
      await setHabitLogStatus(habitId, userId, date, prevLog.status || 'clear');
    }
  } else if (parsed.data.actionType === 'checkin.update') {
    const prev = inverse.prev;
    const date = String(inverse.date);
    if (!prev) {
      const current = await getTodayEntry(userId, date);
      if (current) {
        await db.delete(dailyEntries).where(eq(dailyEntries.id, current.id));
      }
    } else {
      await upsertDailyEntry(userId, date, prev);
    }
  } else if (parsed.data.actionType === 'goal.create' && inverse.goalId) {
    await updateGoal(Number(inverse.goalId), { status: 'paused' });
  } else if (parsed.data.actionType === 'goal.update' && inverse.prev) {
    await updateGoal(Number(inverse.goalId || inverse.prev.id), {
      title: inverse.prev.title,
      category: inverse.prev.category,
      description: inverse.prev.description,
      metric: inverse.prev.metric,
      targetValue: inverse.prev.targetValue,
      currentValue: inverse.prev.currentValue,
      unit: inverse.prev.unit,
      deadline: inverse.prev.deadline,
      status: inverse.prev.status,
      priority: inverse.prev.priority,
    });
  } else if (parsed.data.actionType === 'goal.progress.log' && inverse.goalId) {
    await updateGoal(Number(inverse.goalId), { currentValue: String(inverse.prevCurrentValue ?? '0') });
    await db.delete(goalLogs).where(and(eq(goalLogs.goalId, Number(inverse.goalId)), eq(goalLogs.userId, userId)));
  } else if (parsed.data.actionType === 'calendar.create' && inverse.eventId) {
    const tokens = await getCalendarTokens(userId);
    if (tokens) await deleteEvent(tokens, String(inverse.eventId));
  } else if (parsed.data.actionType === 'calendar.delete' && inverse.prevEvent) {
    const tokens = await getCalendarTokens(userId);
    if (tokens) {
      await createEvent(tokens, {
        summary: inverse.prevEvent.summary,
        description: inverse.prevEvent.description,
        start: inverse.prevEvent.start,
        end: inverse.prevEvent.end,
        allDay: !!inverse.prevEvent.allDay,
      });
    }
  } else if (parsed.data.actionType === 'calendar.update' && inverse.prevEvent) {
    const tokens = await getCalendarTokens(userId);
    if (tokens && inverse.eventId) {
      await updateEvent(tokens, String(inverse.eventId), {
        summary: inverse.prevEvent.summary,
        description: inverse.prevEvent.description,
        start: inverse.prevEvent.start,
        end: inverse.prevEvent.end,
        allDay: !!inverse.prevEvent.allDay,
      });
    }
  }

  await db.update(actionLogs).set({ undone: true }).where(eq(actionLogs.id, row.id));
  return { ok: true, message: 'Última acción revertida.' };
}
