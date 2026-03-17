/**
 * import-diary.ts
 * ───────────────
 * Reads diario_30_dias_detallado.xlsx and generates SQL INSERT statements
 * for the SuccessOS database (daily_entries + patterns tables).
 *
 * Usage:
 *   npx tsx scripts/import-diary.ts
 *
 * Output:
 *   scripts/diary-import.sql
 *
 * No OpenAI API used — all parsing is keyword-based.
 */

import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.join('C:', 'Users', 'joaqu', 'Downloads', 'diario_30_dias_detallado.xlsx');
const OUTPUT_PATH = path.resolve(__dirname, 'diary-import.sql');
const USER_ID = 1;
const YEAR = 2025; // The diary dates are Feb-Mar, infer year from context

// ── Types ───────────────────────────────────────────────────────────────────
interface ExcelRow {
  'Día': number;
  'Fecha': string;
  'Alarma / Levantada': string;
  'Mañana (hasta almuerzo)': string;
  'Tarde (almuerzo → noche)': string;
  'Noche (cena en adelante)': string;
  'Rezo': string;
  'Gym': string;
  'Facultad / Estudio': string;
  'Gorila / Proyectos': string;
  'Notas del día': string;
}

interface DailyEntry {
  date: string;          // YYYY-MM-DD
  bedtime: string | null;
  wakeTime: string | null;
  sleepQuality: number | null;
  sleepNote: string | null;
  energyLevel: number | null;
  energyNote: string | null;
  exerciseDone: boolean;
  exerciseType: string | null;
  exerciseDuration: number | null;
  exerciseNote: string | null;
  dietEntries: any[] | null;
  dietQuality: number | null;
  dietNote: string | null;
  mood: number | null;
  emotionalState: string | null;
  emotionalNote: string | null;
  focusHours: number | null;
  tasksCompleted: number | null;
  procrastination: boolean;
  biggestWin: string | null;
  productivityNote: string | null;
  socialEvent: string | null;
  relationshipsNote: string | null;
  vicesDetails: any | null;
  vicesNote: string | null;
  overallScore: number | null;
  dayRating: number | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(fecha: string): string {
  // "Lunes 10/02" -> "2025-02-10"
  const m = fecha.match(/(\d{1,2})\/(\d{2})/);
  if (!m) throw new Error(`Cannot parse date: ${fecha}`);
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  // If month is 1, 2 or 3 with year context starting Feb 2025
  const year = month <= 2 ? 2025 : (month === 3 ? 2025 : 2025);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseWakeTime(alarm: string): string | null {
  // "7:50 / Me levanté 8:15" -> "08:15"
  // "7:50 / 7:55" -> "07:55"
  // "Sin alarma / 10:45" -> "10:45"
  const parts = alarm.split('/');
  if (parts.length < 2) return null;
  const wakeStr = parts[1].trim();

  // Match HH:MM or H:MM
  const m = wakeStr.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    return `${String(parseInt(m[1])).padStart(2, '0')}:${m[2]}`;
  }
  // Also try just a single number with context: "8:15"
  // or "Me levanté 8:15" where number is embedded
  const m2 = alarm.match(/levant[éeao]\s+(?:a\s+las?\s+)?(\d{1,2}):?(\d{2})?/i);
  if (m2) {
    const h = parseInt(m2[1]);
    const min = m2[2] ? m2[2] : '00';
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  return null;
}

function parseBedtime(noche: string, notas: string): string | null {
  const combined = `${noche} ${notas}`;

  // "Me acosté 1:30" / "Me acosté a la 1:30" / "Me acosté a las 00:30"
  const patterns = [
    /(?:me\s+(?:acost[éeao]|dorm[íi])|a\s+dormir)\s+(?:a\s+(?:las?|la)\s+)?(\d{1,2})[:\.](\d{2})/i,
    /(?:me\s+(?:acost[éeao]|dorm[íi])|a\s+dormir)\s+(?:a\s+(?:las?|la)\s+)?(\d{1,2})\b/i,
    /(?:me\s+(?:acost[éeao]|dorm[íi]))\s+(?:tipo|como|cerca\s+de)\s+(?:(?:las?|la)\s+)?(\d{1,2})[:\.]?(\d{2})?/i,
    /(?:me\s+(?:fu[ié]\s+a\s+(?:dormir|la\s+cama)))\s+(?:a\s+(?:las?|la)\s+)?(\d{1,2})[:\.]?(\d{2})?/i,
    /(?:temprano,?\s+)(\d{1,2})[:\.]?(\d{2})?/i,
  ];

  for (const pat of patterns) {
    const m = combined.match(pat);
    if (m) {
      const h = parseInt(m[1]);
      const min = m[2] ? m[2] : '00';
      // If hour is between 1 and 5, it's past midnight -> keep as is
      // If >= 20, it's PM of same day -> keep
      const hStr = String(h).padStart(2, '0');
      return `${hStr}:${min}`;
    }
  }
  return null;
}

function estimateSleepQuality(alarm: string, noche: string, notas: string): number | null {
  const combined = `${alarm} ${noche} ${notas}`.toLowerCase();
  let score = 6; // baseline

  if (combined.includes('dormí mal') || combined.includes('dormí pésimo')) score -= 2;
  if (combined.includes('dormí bien') || combined.includes('bien dormido')) score += 1;
  if (combined.includes('me desperté') && combined.includes('veces')) score -= 1;
  if (combined.includes('snooze')) score -= 1;
  if (combined.includes('temprano y bien') || combined.includes('dormí temprano')) score += 1;
  if (combined.includes('resaca') || combined.includes('destruido')) score -= 2;
  if (combined.includes('como 9 horas') || combined.includes('9 horas')) score += 1;
  if (combined.includes('calor')) score -= 1;
  if (combined.includes('dolor')) score -= 1;

  return Math.max(1, Math.min(10, score));
}

function estimateMood(row: ExcelRow): number {
  const combined = [
    row['Mañana (hasta almuerzo)'],
    row['Tarde (almuerzo → noche)'],
    row['Noche (cena en adelante)'],
    row['Notas del día'],
  ].join(' ').toLowerCase();

  let score = 6;

  // Positive keywords
  const positives = [
    'motivado', 'productivo', 'buen día', 'bien', 'contento', 'manija',
    'copado', 'progresando', 'logro', 'aprobé', 'nuevo peso', 'nuevo rm',
    'festejo', 'gran día', 'mejor', 'equilibrado', 'redención', 'compensé',
    'recargué', 'lindo', 'tranquilo', 'satisfecho', 'orgulloso',
  ];
  const negatives = [
    'mal', 'cansado', 'bajón', 'culpa', 'procrastinación', 'improductivo',
    'flojo', 'nulo', 'cero', 'destruido', 'resaca', 'lento', 'distracción',
    'me come la cabeza', 'robaron horas', 'costó horrores', 'rendí mal',
    'pésimo', 'dolor',
  ];

  for (const w of positives) {
    if (combined.includes(w)) score += 0.5;
  }
  for (const w of negatives) {
    if (combined.includes(w)) score -= 0.5;
  }

  // Big boosts/drops
  if (combined.includes('gran día') || combined.includes('mejores días')) score += 1.5;
  if (combined.includes('aprobé')) score += 1.5;
  if (combined.includes('primer cliente')) score += 1.5;

  return Math.max(1, Math.min(10, Math.round(score)));
}

function estimateEnergy(row: ExcelRow): number {
  const alarm = row['Alarma / Levantada'].toLowerCase();
  const combined = [
    row['Mañana (hasta almuerzo)'],
    row['Tarde (almuerzo → noche)'],
    row['Noche (cena en adelante)'],
    row['Notas del día'],
  ].join(' ').toLowerCase();

  let score = 6;

  // Wake time hints
  if (alarm.includes('sin alarma') && (alarm.includes('10:') || alarm.includes('11:'))) score -= 1;
  if (alarm.includes('destruido') || alarm.includes('resaca')) score -= 2;
  if (alarm.includes('me levanté bien') || alarm.includes('de una')) score += 1;
  if (alarm.includes('costó horrores') || alarm.includes('costó arrancar')) score -= 1;

  // Content hints
  if (combined.includes('cansado') || combined.includes('fundido') || combined.includes('dolorido')) score -= 1;
  if (combined.includes('motivado') || combined.includes('determinación')) score += 1;
  if (combined.includes('productivo')) score += 0.5;
  if (combined.includes('desgaste mental')) score -= 0.5;
  if (combined.includes('dormí mal') || combined.includes('dormí pésimo')) score -= 1;
  if (combined.includes('había dormido como 9 horas')) score += 1;

  return Math.max(1, Math.min(10, Math.round(score)));
}

function parseExercise(gym: string): { done: boolean; type: string | null; duration: number | null; note: string | null } {
  const g = gym.trim().toLowerCase();
  if (!g || g === 'descanso' || g === 'descanso.' || g.startsWith('no fui') || g.includes('no fui')) {
    return { done: false, type: null, duration: null, note: g || null };
  }

  let type: string | null = null;
  let duration: number | null = 60; // default gym session ~60min
  let note = gym.trim();

  if (g.includes('pecho') && g.includes('tríceps')) type = 'Pecho y tríceps';
  else if (g.includes('espalda') && g.includes('bíceps')) type = 'Espalda y bíceps';
  else if (g.includes('pierna')) type = 'Piernas';
  else if (g.includes('hombro')) type = 'Hombros y trapecios';
  else if (g.includes('pecho')) type = 'Pecho';

  if (g.includes('liviano') || g.includes('suave') || g.includes('técnica')) {
    duration = 45;
  }

  return { done: true, type, duration, note };
}

function parseFocusHours(facultad: string, gorila: string): number {
  let total = 0;
  const combined = `${facultad} ${gorila}`.toLowerCase();

  // Look for explicit hour mentions: "2hs", "~1.5hs", "1h", "3hs", "30min", "10 min"
  const hourMatches = combined.matchAll(/~?(\d+\.?\d*)\s*h(?:s|oras?)?\b/gi);
  for (const m of hourMatches) {
    total += parseFloat(m[1]);
  }

  // Look for minute mentions: "30min", "10 min", "15 minutos"
  const minMatches = combined.matchAll(/(\d+)\s*min(?:utos?)?\b/gi);
  for (const m of minMatches) {
    total += parseInt(m[1]) / 60;
  }

  // If nothing found but there's text suggesting work
  if (total === 0) {
    if (facultad.toLowerCase().includes('nada') || facultad.toLowerCase().includes('cero')) {
      // check gorila
      if (gorila && !gorila.toLowerCase().includes('nada') && gorila.trim().length > 20) {
        total = 1; // some gorila work
      }
    }
  }

  return Math.round(total * 10) / 10; // 1 decimal
}

function detectProcrastination(row: ExcelRow): boolean {
  const combined = [
    row['Mañana (hasta almuerzo)'],
    row['Tarde (almuerzo → noche)'],
    row['Noche (cena en adelante)'],
    row['Notas del día'],
  ].join(' ').toLowerCase();

  const keywords = [
    'procrastinación', 'me colgué', 'scrolleando', 'reels', 'tiktok',
    'instagram', 'me robaron horas', 'serie me comió', 'serie me atrapó',
    'celu en la mano', 'distracción', 'no me concentré',
  ];

  return keywords.some(k => combined.includes(k));
}

function detectSocial(row: ExcelRow): string | null {
  const combined = [
    row['Mañana (hasta almuerzo)'],
    row['Tarde (almuerzo → noche)'],
    row['Noche (cena en adelante)'],
    row['Notas del día'],
  ].join(' ').toLowerCase();

  const events: string[] = [];

  if (combined.includes('asado')) events.push('Asado');
  if (combined.includes('amigos') || combined.includes('pibes')) events.push('Amigos');
  if (combined.includes('boliche') || combined.includes('bar') || combined.includes('salida')) events.push('Salida');
  if (combined.includes('costanera')) events.push('Costanera');
  if (combined.includes('misa')) events.push('Misa');
  if (combined.includes('familia')) events.push('Familia');
  if (combined.includes('pizza')) events.push('Pizza');
  if (combined.includes('fifa')) events.push('FIFA');

  return events.length > 0 ? events.join(', ') : null;
}

function detectVices(row: ExcelRow): { details: any; note: string | null } {
  const combined = [
    row['Mañana (hasta almuerzo)'],
    row['Tarde (almuerzo → noche)'],
    row['Noche (cena en adelante)'],
    row['Notas del día'],
  ].join(' ').toLowerCase();

  const vices: Record<string, boolean> = {};
  let note: string[] = [];

  if (combined.includes('scrolleando') || combined.includes('reels') ||
      combined.includes('tiktok') || combined.includes('instagram') ||
      combined.includes('me colgué')) {
    vices.screens_late = true;
    note.push('Pantallas/redes sociales excesivas');
  }
  if (combined.includes('serie me comió') || combined.includes('serie me atrapó') ||
      combined.includes('viendo la serie')) {
    vices.series_binge = true;
    note.push('Binge de series');
  }
  if (combined.includes('birra') || combined.includes('fernet') ||
      combined.includes('alcohol') || combined.includes('boliche') ||
      combined.includes('resaca')) {
    vices.alcohol = true;
    note.push('Alcohol');
  }
  if (combined.includes('snooze')) {
    vices.snooze = true;
    note.push('Snooze');
  }

  return {
    details: Object.keys(vices).length > 0 ? vices : null,
    note: note.length > 0 ? note.join('; ') : null,
  };
}

function detectDiet(row: ExcelRow): { entries: any[]; quality: number; note: string } {
  const morning = row['Mañana (hasta almuerzo)'].toLowerCase();
  const afternoon = row['Tarde (almuerzo → noche)'].toLowerCase();
  const evening = row['Noche (cena en adelante)'].toLowerCase();

  const entries: any[] = [];
  let quality = 6;

  // Breakfast
  const breakfastKeywords = ['desayuné', 'desayuno', 'mate cocido', 'café', 'tostadas', 'yogur', 'granola', 'cereales', 'huevos'];
  for (const k of breakfastKeywords) {
    if (morning.includes(k)) {
      const snippet = morning.substring(
        Math.max(0, morning.indexOf(k) - 10),
        Math.min(morning.length, morning.indexOf(k) + 50)
      );
      entries.push({ meal: 'desayuno', desc: snippet.trim() });
      break;
    }
  }

  // Lunch
  const lunchKeywords = ['almorcé', 'almuerzo', 'fideos', 'milanesa', 'arroz', 'ensalada', 'pollo', 'carne', 'hamburguesa', 'guiso'];
  for (const k of lunchKeywords) {
    if (afternoon.includes(k)) {
      const snippet = afternoon.substring(
        Math.max(0, afternoon.indexOf(k) - 10),
        Math.min(afternoon.length, afternoon.indexOf(k) + 60)
      );
      entries.push({ meal: 'almuerzo', desc: snippet.trim() });
      break;
    }
  }

  // Dinner
  const dinnerKeywords = ['cené', 'cena', 'pizza', 'empanadas', 'asado', 'fideos', 'arroz', 'milanesa', 'hamburguesa'];
  for (const k of dinnerKeywords) {
    if (evening.includes(k)) {
      const snippet = evening.substring(
        Math.max(0, evening.indexOf(k) - 10),
        Math.min(evening.length, evening.indexOf(k) + 60)
      );
      entries.push({ meal: 'cena', desc: snippet.trim() });
      break;
    }
  }

  // Quality adjustments
  const allFood = `${morning} ${afternoon} ${evening}`;
  if (allFood.includes('fruta') || allFood.includes('ensalada') || allFood.includes('verdura')) quality += 1;
  if (allFood.includes('pizza') || allFood.includes('hamburguesa') || allFood.includes('pancho')) quality -= 1;
  if (allFood.includes('asado')) quality += 0; // neutral, it's normal
  if (allFood.includes('birra') || allFood.includes('fernet')) quality -= 1;

  return {
    entries: entries.length > 0 ? entries : [],
    quality: Math.max(1, Math.min(10, quality)),
    note: entries.map(e => `${e.meal}: ${e.desc}`).join('; ') || '',
  };
}

function extractBiggestWin(row: ExcelRow): string | null {
  const notas = row['Notas del día'];
  const combined = `${row['Facultad / Estudio']} ${row['Gorila / Proyectos']} ${notas}`;

  // Look for standout achievements
  if (combined.includes('NUEVO RM') || combined.includes('NUEVO PESO') || combined.includes('nuevo peso')) {
    const m = combined.match(/(?:NUEVO RM|NUEVO PESO|nuevo peso)[^.]*\.?/i);
    return m ? m[0].trim() : 'Nuevo RM en gym';
  }
  if (combined.includes('APROBÉ') || combined.includes('aprobé')) {
    const m = combined.match(/aprobé[^.]*\.?/i);
    return m ? m[0].trim() : 'Aprobó parcial';
  }
  if (combined.includes('PRIMER CLIENTE') || combined.includes('primer cliente')) {
    return 'Primer cliente cerrado';
  }
  if (combined.includes('GRAN DÍA') || combined.includes('gran día')) {
    return notas.substring(0, 80);
  }
  if (combined.includes('subí peso') || combined.includes('subí)')) {
    return 'Subió peso en gym';
  }

  return null;
}

function estimateOverallScore(entry: DailyEntry, row: ExcelRow): number {
  let score = 5;

  // Exercise
  if (entry.exerciseDone) score += 1;

  // Study/work
  if (entry.focusHours && entry.focusHours >= 3) score += 1.5;
  else if (entry.focusHours && entry.focusHours >= 1.5) score += 0.5;
  else if (entry.focusHours === 0) score -= 0.5;

  // Procrastination
  if (entry.procrastination) score -= 1;

  // Mood boost
  if (entry.mood && entry.mood >= 8) score += 0.5;
  if (entry.mood && entry.mood <= 4) score -= 0.5;

  // Social (generally positive)
  if (entry.socialEvent) score += 0.3;

  // Vices
  if (entry.vicesDetails) score -= 0.5;

  // Prayer (from original data)
  const rezo = row['Rezo'].toLowerCase();
  if (rezo.includes('sí') || rezo.includes('misa') || rezo.includes('rosario')) score += 0.3;

  return Math.max(1, Math.min(10, Math.round(score)));
}

function emotionalState(mood: number): string {
  if (mood >= 8) return 'motivado';
  if (mood >= 6) return 'estable';
  if (mood >= 4) return 'neutro';
  return 'bajo';
}

function escSQL(val: string | null): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

function escJSON(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Reading Excel from: ${EXCEL_PATH}`);
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as ExcelRow[];
  console.log(`Found ${rows.length} rows`);

  const entries: DailyEntry[] = [];
  const sql: string[] = [];

  sql.push('-- ═══════════════════════════════════════════════════════');
  sql.push('-- SuccessOS Diary Import - 30 days');
  sql.push('-- Generated by import-diary.ts');
  sql.push(`-- Date: ${new Date().toISOString()}`);
  sql.push('-- ═══════════════════════════════════════════════════════');
  sql.push('');
  sql.push('BEGIN TRANSACTION;');
  sql.push('');
  sql.push('-- ── Daily Entries ──────────────────────────────────────');
  sql.push('');

  for (const row of rows) {
    const date = parseDate(row['Fecha']);
    const wakeTime = parseWakeTime(row['Alarma / Levantada']);
    const bedtime = parseBedtime(
      row['Noche (cena en adelante)'],
      row['Notas del día']
    );
    const sleepQuality = estimateSleepQuality(
      row['Alarma / Levantada'],
      row['Noche (cena en adelante)'],
      row['Notas del día']
    );
    const exercise = parseExercise(row['Gym']);
    const mood = estimateMood(row);
    const energy = estimateEnergy(row);
    const focusHours = parseFocusHours(row['Facultad / Estudio'], row['Gorila / Proyectos']);
    const procrastination = detectProcrastination(row);
    const social = detectSocial(row);
    const vices = detectVices(row);
    const diet = detectDiet(row);
    const biggestWin = extractBiggestWin(row);
    const emState = emotionalState(mood);

    const entry: DailyEntry = {
      date,
      bedtime,
      wakeTime,
      sleepQuality,
      sleepNote: row['Alarma / Levantada'],
      energyLevel: energy,
      energyNote: null,
      exerciseDone: exercise.done,
      exerciseType: exercise.type,
      exerciseDuration: exercise.duration,
      exerciseNote: exercise.note,
      dietEntries: diet.entries.length > 0 ? diet.entries : null,
      dietQuality: diet.quality,
      dietNote: diet.note || null,
      mood,
      emotionalState: emState,
      emotionalNote: row['Notas del día'].substring(0, 200),
      focusHours,
      tasksCompleted: null,
      procrastination,
      biggestWin,
      productivityNote: [
        row['Facultad / Estudio'] ? `Facu: ${row['Facultad / Estudio'].substring(0, 100)}` : null,
        row['Gorila / Proyectos'] ? `Gorila: ${row['Gorila / Proyectos'].substring(0, 100)}` : null,
      ].filter(Boolean).join(' | ') || null,
      socialEvent: social,
      relationshipsNote: null,
      vicesDetails: vices.details,
      vicesNote: vices.note,
      overallScore: 0, // computed below
      dayRating: 0,
    };

    entry.overallScore = estimateOverallScore(entry, row);
    entry.dayRating = entry.overallScore; // same for now

    entries.push(entry);

    const now = new Date().toISOString();
    sql.push(`-- Día ${row['Día']}: ${row['Fecha']}`);
    sql.push(`INSERT INTO daily_entries (`);
    sql.push(`  user_id, date,`);
    sql.push(`  bedtime, wake_time, sleep_quality, sleep_note,`);
    sql.push(`  energy_level, energy_note,`);
    sql.push(`  exercise_done, exercise_type, exercise_duration, exercise_note,`);
    sql.push(`  diet_entries, diet_quality, diet_note,`);
    sql.push(`  mood, emotional_state, emotional_note,`);
    sql.push(`  focus_hours, tasks_completed, procrastination, biggest_win, productivity_note,`);
    sql.push(`  social_event, relationships_note,`);
    sql.push(`  vices_details, vices_note,`);
    sql.push(`  overall_score, day_rating,`);
    sql.push(`  created_at, updated_at`);
    sql.push(`) VALUES (`);
    sql.push(`  ${USER_ID}, ${escSQL(entry.date)},`);
    sql.push(`  ${escSQL(entry.bedtime)}, ${escSQL(entry.wakeTime)}, ${entry.sleepQuality}, ${escSQL(entry.sleepNote)},`);
    sql.push(`  ${entry.energyLevel}, ${escSQL(entry.energyNote)},`);
    sql.push(`  ${entry.exerciseDone ? 1 : 0}, ${escSQL(entry.exerciseType)}, ${entry.exerciseDuration ?? 'NULL'}, ${escSQL(entry.exerciseNote)},`);
    sql.push(`  ${escJSON(entry.dietEntries)}, ${entry.dietQuality}, ${escSQL(entry.dietNote)},`);
    sql.push(`  ${entry.mood}, ${escSQL(entry.emotionalState)}, ${escSQL(entry.emotionalNote)},`);
    sql.push(`  ${entry.focusHours}, ${entry.tasksCompleted ?? 'NULL'}, ${entry.procrastination ? 1 : 0}, ${escSQL(entry.biggestWin)}, ${escSQL(entry.productivityNote)},`);
    sql.push(`  ${escSQL(entry.socialEvent)}, ${escSQL(entry.relationshipsNote)},`);
    sql.push(`  ${escJSON(entry.vicesDetails)}, ${escSQL(entry.vicesNote)},`);
    sql.push(`  ${entry.overallScore}, ${entry.dayRating},`);
    sql.push(`  ${escSQL(now)}, ${escSQL(now)}`);
    sql.push(`);`);
    sql.push('');
  }

  // ── Habit logs (gym, rezo) ──────────────────────────────────────────────
  sql.push('-- ── Habit Logs (Gym + Rezo) ─────────────────────────────');
  sql.push('-- NOTE: These require habit IDs to exist first. Run these');
  sql.push('-- after creating the habits via the bot or manually.');
  sql.push('-- Gym habit = ID 1, Rezo habit = ID 2 (adjust as needed)');
  sql.push('');

  for (const row of rows) {
    const date = parseDate(row['Fecha']);
    const gymDone = parseExercise(row['Gym']).done;
    const rezoDone = row['Rezo'].toLowerCase().includes('sí') ||
                     row['Rezo'].toLowerCase().includes('misa') ||
                     row['Rezo'].toLowerCase().includes('rosario');

    sql.push(`-- ${row['Fecha']}`);
    sql.push(`-- INSERT INTO habit_logs (habit_id, user_id, date, completed, created_at) VALUES (1, ${USER_ID}, '${date}', ${gymDone ? 1 : 0}, '${new Date().toISOString()}');`);
    sql.push(`-- INSERT INTO habit_logs (habit_id, user_id, date, completed, created_at) VALUES (2, ${USER_ID}, '${date}', ${rezoDone ? 1 : 0}, '${new Date().toISOString()}');`);
    sql.push('');
  }

  // ── Patterns / Correlations ─────────────────────────────────────────────
  sql.push('-- ── Patterns / Correlations ──────────────────────────────');
  sql.push('');

  // Compute actual correlations from data
  const gymDays = entries.filter(e => e.exerciseDone);
  const noGymDays = entries.filter(e => !e.exerciseDone);
  const avgMoodGym = gymDays.reduce((s, e) => s + (e.mood || 0), 0) / gymDays.length;
  const avgMoodNoGym = noGymDays.reduce((s, e) => s + (e.mood || 0), 0) / noGymDays.length;

  const avgEnergyGym = gymDays.reduce((s, e) => s + (e.energyLevel || 0), 0) / gymDays.length;
  const avgEnergyNoGym = noGymDays.reduce((s, e) => s + (e.energyLevel || 0), 0) / noGymDays.length;

  const procrDays = entries.filter(e => e.procrastination);
  const noProcrDays = entries.filter(e => !e.procrastination);
  const avgFocusProcr = procrDays.length > 0 ? procrDays.reduce((s, e) => s + (e.focusHours || 0), 0) / procrDays.length : 0;
  const avgFocusNoProcr = noProcrDays.length > 0 ? noProcrDays.reduce((s, e) => s + (e.focusHours || 0), 0) / noProcrDays.length : 0;

  // Early wake vs productivity
  const earlyWake = entries.filter(e => {
    if (!e.wakeTime) return false;
    const h = parseInt(e.wakeTime.split(':')[0]);
    return h <= 8;
  });
  const lateWake = entries.filter(e => {
    if (!e.wakeTime) return false;
    const h = parseInt(e.wakeTime.split(':')[0]);
    return h >= 9;
  });
  const avgFocusEarly = earlyWake.length > 0 ? earlyWake.reduce((s, e) => s + (e.focusHours || 0), 0) / earlyWake.length : 0;
  const avgFocusLate = lateWake.length > 0 ? lateWake.reduce((s, e) => s + (e.focusHours || 0), 0) / lateWake.length : 0;

  const now = new Date().toISOString();

  const patternData = [
    {
      type: 'correlation',
      areaA: 'exercise',
      areaB: 'mood',
      desc: `Gym mejora ánimo: promedio mood gym=${avgMoodGym.toFixed(1)} vs no-gym=${avgMoodNoGym.toFixed(1)}`,
      corr: Math.min(1, Math.max(-1, (avgMoodGym - avgMoodNoGym) / 5)),
      points: 30,
      conf: 0.7,
    },
    {
      type: 'correlation',
      areaA: 'exercise',
      areaB: 'energy',
      desc: `Gym mejora energía: promedio energy gym=${avgEnergyGym.toFixed(1)} vs no-gym=${avgEnergyNoGym.toFixed(1)}`,
      corr: Math.min(1, Math.max(-1, (avgEnergyGym - avgEnergyNoGym) / 5)),
      points: 30,
      conf: 0.7,
    },
    {
      type: 'correlation',
      areaA: 'vices',
      areaB: 'productivity',
      desc: `Procrastinación baja focus: promedio hs con=${avgFocusProcr.toFixed(1)} vs sin=${avgFocusNoProcr.toFixed(1)}`,
      corr: Math.min(1, Math.max(-1, (avgFocusProcr - avgFocusNoProcr) / 5)),
      points: 30,
      conf: 0.65,
    },
    {
      type: 'correlation',
      areaA: 'sleep',
      areaB: 'productivity',
      desc: `Levantarse temprano (<=8am) mejora focus: ${avgFocusEarly.toFixed(1)}hs vs tarde (>=9am): ${avgFocusLate.toFixed(1)}hs`,
      corr: Math.min(1, Math.max(-1, (avgFocusEarly - avgFocusLate) / 5)),
      points: 30,
      conf: 0.6,
    },
    {
      type: 'trend',
      areaA: 'exercise',
      areaB: 'exercise',
      desc: `Gym 4x/semana consistente. Press plano progresó: 60kg -> 65kg -> 70kg RM en 30 días.`,
      corr: 0.85,
      points: 30,
      conf: 0.9,
    },
    {
      type: 'trend',
      areaA: 'productivity',
      areaB: 'productivity',
      desc: `Patrón: viernes/sábado = cero estudio. Lunes-miércoles más productivos.`,
      corr: 0,
      points: 30,
      conf: 0.85,
    },
    {
      type: 'anomaly',
      areaA: 'mood',
      areaB: 'productivity',
      desc: `Día 29 (lunes 10/03) fue outlier positivo: primer cliente + 70kg RM + buen estudio = mood 10.`,
      corr: 0.95,
      points: 1,
      conf: 0.95,
    },
  ];

  for (const p of patternData) {
    sql.push(`INSERT INTO patterns (`);
    sql.push(`  user_id, pattern_type, area_a, area_b, description, correlation, data_points, confidence, active, created_at, updated_at`);
    sql.push(`) VALUES (`);
    sql.push(`  ${USER_ID}, ${escSQL(p.type)}, ${escSQL(p.areaA)}, ${escSQL(p.areaB)}, ${escSQL(p.desc)}, ${p.corr.toFixed(3)}, ${p.points}, ${p.conf}, 1, ${escSQL(now)}, ${escSQL(now)}`);
    sql.push(`);`);
    sql.push('');
  }

  sql.push('COMMIT;');
  sql.push('');

  // ── Summary stats ───────────────────────────────────────────────────────
  sql.push('-- ═══════════════════════════════════════════════════════');
  sql.push('-- SUMMARY STATS');
  sql.push(`-- Total days: ${entries.length}`);
  sql.push(`-- Gym days: ${entries.filter(e => e.exerciseDone).length}`);
  sql.push(`-- Avg mood: ${(entries.reduce((s, e) => s + (e.mood || 0), 0) / entries.length).toFixed(1)}`);
  sql.push(`-- Avg energy: ${(entries.reduce((s, e) => s + (e.energyLevel || 0), 0) / entries.length).toFixed(1)}`);
  sql.push(`-- Avg focus hours: ${(entries.reduce((s, e) => s + (e.focusHours || 0), 0) / entries.length).toFixed(1)}`);
  sql.push(`-- Days with procrastination: ${entries.filter(e => e.procrastination).length}`);
  sql.push(`-- Avg overall score: ${(entries.reduce((s, e) => s + (e.overallScore || 0), 0) / entries.length).toFixed(1)}`);
  sql.push('-- ═══════════════════════════════════════════════════════');

  const output = sql.join('\n');
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`\nSQL written to: ${OUTPUT_PATH}`);
  console.log(`Total INSERT statements: ${entries.length} daily_entries + ${patternData.length} patterns`);
  console.log(`\n── Summary ──`);
  console.log(`Days: ${entries.length}`);
  console.log(`Gym days: ${entries.filter(e => e.exerciseDone).length}/${entries.length}`);
  console.log(`Avg mood: ${(entries.reduce((s, e) => s + (e.mood || 0), 0) / entries.length).toFixed(1)}`);
  console.log(`Avg energy: ${(entries.reduce((s, e) => s + (e.energyLevel || 0), 0) / entries.length).toFixed(1)}`);
  console.log(`Avg focus hours/day: ${(entries.reduce((s, e) => s + (e.focusHours || 0), 0) / entries.length).toFixed(1)}`);
  console.log(`Days w/ procrastination: ${entries.filter(e => e.procrastination).length}`);
}

main();
