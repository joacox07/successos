import { config } from '../config.js';

/** Get today's date as YYYY-MM-DD in the configured timezone */
export function getTodayDate(timezone = config.timezone): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

/** Get current time as HH:MM in the configured timezone */
export function getCurrentHHMM(timezone = config.timezone): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Check if current time is within a 15-minute window of target HH:MM */
export function isWithinWindow(current: string, target: string): boolean {
  const [ch, cm] = current.split(':').map(Number);
  const [th, tm] = target.split(':').map(Number);
  if (isNaN(ch) || isNaN(cm) || isNaN(th) || isNaN(tm)) return false;
  const currentMin = ch * 60 + cm;
  const targetMin = th * 60 + tm;
  return currentMin >= targetMin && currentMin < targetMin + 15;
}

/** Get date range for reports */
export function getDateRange(
  type: 'weekly' | 'monthly',
  timezone = config.timezone,
): { start: string; end: string } {
  const end = getTodayDate(timezone);
  const [y, m, d] = end.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  if (type === 'weekly') {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }
  const start = startDate.toLocaleDateString('en-CA');
  return { start, end };
}

export function isFirstOfMonth(timezone = config.timezone): boolean {
  return getTodayDate(timezone).endsWith('-01');
}

export function isSunday(timezone = config.timezone): boolean {
  const dow = new Date().toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
  return dow === 'Sun';
}

export function normalizeDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function getEditableDateWindow(timezone = config.timezone) {
  const today = parseDateKey(getTodayDate(timezone))!;
  const oldest = addUtcDays(today, -3);
  return {
    today: normalizeDateKey(today),
    oldest: normalizeDateKey(oldest),
  };
}

export function isEditableDate(value: string, timezone = config.timezone): boolean {
  const target = parseDateKey(value);
  if (!target) return false;
  const { today, oldest } = getEditableDateWindow(timezone);
  return value >= oldest && value <= today;
}

export function assertEditableDate(value: string, timezone = config.timezone) {
  if (!isEditableDate(value, timezone)) {
    throw new Error('Solo podés modificar hoy y los últimos 3 días');
  }
}

const MONTHS_ES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const WEEKDAYS_ES: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

export function resolveTargetDateFromText(
  text: string,
  timezone = config.timezone,
): { date: string | null; matched: boolean; ambiguous: boolean } {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const today = parseDateKey(getTodayDate(timezone))!;

  if (/\bhoy\b/.test(normalized)) {
    return { date: normalizeDateKey(today), matched: true, ambiguous: false };
  }
  if (/\banteayer\b/.test(normalized)) {
    return { date: normalizeDateKey(addUtcDays(today, -2)), matched: true, ambiguous: false };
  }
  if (/\bayer\b/.test(normalized)) {
    return { date: normalizeDateKey(addUtcDays(today, -1)), matched: true, ambiguous: false };
  }

  const agoMatch = normalized.match(/\bhace\s+([1-3])\s+d[ií]as?\b/);
  if (agoMatch) {
    return { date: normalizeDateKey(addUtcDays(today, -Number(agoMatch[1]))), matched: true, ambiguous: false };
  }

  const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return { date: isoMatch[1], matched: true, ambiguous: false };
  }

  const monthMatch = normalized.match(/\b(?:el\s+)?(\d{1,2})\s+de\s+([a-zñ]+)/);
  if (monthMatch) {
    const day = Number(monthMatch[1]);
    const month = MONTHS_ES[monthMatch[2]];
    if (!Number.isNaN(day) && month !== undefined) {
      const year = today.getUTCFullYear();
      let candidate = new Date(Date.UTC(year, month, day));
      if (candidate.getTime() > today.getTime()) {
        candidate = new Date(Date.UTC(year - 1, month, day));
      }
      return { date: normalizeDateKey(candidate), matched: true, ambiguous: false };
    }
  }

  const weekdayMatch = normalized.match(/\b(?:el\s+)?(domingo|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado)\b/);
  if (weekdayMatch) {
    const weekday = WEEKDAYS_ES[weekdayMatch[1]];
    if (weekday !== undefined) {
      const todayWeekday = today.getUTCDay();
      const diff = (todayWeekday - weekday + 7) % 7;
      return { date: normalizeDateKey(addUtcDays(today, -diff)), matched: true, ambiguous: false };
    }
  }

  const ambiguous =
    /\b(me olvide|me olvid[eé]|colga(do|da)|no marque|no tild[eé]|no checke[eé]|te falto anotar|falto anotar|corrigi|corregi|ajusta|ajusta eso)\b/.test(normalized);

  return { date: null, matched: false, ambiguous };
}
