/**
 * Seed script — fills the database with realistic March 2026 test data
 * for all parts of the app: daily entries, messages, habits, goals,
 * study sessions, patterns, and reports.
 *
 * Usage: npx tsx scripts/seed-march.ts
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

const DB_PATH = resolve('data/successos.db');
mkdirSync('data', { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Helpers ─────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isoTs(date: string, hour: number, min: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00.000Z`;
}

// ── Get or create user ──────────────────────────────────────

let user = db.prepare('SELECT id FROM users LIMIT 1').get() as any;
if (!user) {
  db.prepare(`INSERT INTO users (phone, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
    '+5491100000000', 'Joaquin', new Date().toISOString(), new Date().toISOString()
  );
  user = db.prepare('SELECT id FROM users ORDER BY id DESC LIMIT 1').get() as any;
}
const userId = user.id;
console.log(`Using userId = ${userId}`);

// ── Clean old data for March 2026 ───────────────────────────

console.log('Cleaning existing March 2026 data...');
db.prepare(`DELETE FROM daily_entries WHERE user_id = ? AND date LIKE '2026-03-%'`).run(userId);
db.prepare(`DELETE FROM messages WHERE user_id = ? AND timestamp LIKE '2026-03-%'`).run(userId);
db.prepare(`DELETE FROM habit_logs WHERE user_id = ? AND date LIKE '2026-03-%'`).run(userId);
db.prepare(`DELETE FROM goal_logs WHERE user_id = ? AND date LIKE '2026-03-%'`).run(userId);
db.prepare(`DELETE FROM study_sessions WHERE user_id = ? AND date LIKE '2026-03-%'`).run(userId);
db.prepare(`DELETE FROM patterns WHERE user_id = ?`).run(userId);

// ── Create Habits (if they don't exist) ─────────────────────

const existingHabits = db.prepare('SELECT id, name FROM habits WHERE user_id = ? AND active = 1').all(userId) as any[];

const HABIT_DEFS = [
  { name: 'Meditar', emoji: '🧘', category: 'espiritual' },
  { name: 'Leer 30 min', emoji: '📖', category: 'educacion' },
  { name: 'Ejercicio', emoji: '💪', category: 'salud' },
  { name: 'No redes sociales', emoji: '📵', category: 'personal' },
  { name: 'Journaling', emoji: '📝', category: 'personal' },
  { name: 'Agua 2L', emoji: '💧', category: 'salud' },
];

const habitIds: number[] = [];
for (const h of HABIT_DEFS) {
  const existing = existingHabits.find((e: any) => e.name === h.name);
  if (existing) {
    habitIds.push(existing.id);
  } else {
    const result = db.prepare(
      'INSERT INTO habits (user_id, name, emoji, category, frequency, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    ).run(userId, h.name, h.emoji, h.category, 'daily', new Date().toISOString(), new Date().toISOString());
    habitIds.push(Number(result.lastInsertRowid));
  }
}
console.log(`Habits ready: ${habitIds.length} habits`);

// ── Create Goals (if they don't exist) ──────────────────────

const existingGoals = db.prepare("SELECT id, title FROM goals WHERE user_id = ? AND status = 'active'").all(userId) as any[];

const GOAL_DEFS = [
  { title: 'Perder 5kg', category: 'salud', description: 'Bajar de 80 a 75kg', metric: 'peso', targetValue: '75', currentValue: '77.5', unit: 'kg', priority: 1 },
  { title: 'Leer 12 libros', category: 'personal', description: '1 libro por mes', metric: 'libros', targetValue: '12', currentValue: '3', unit: 'libros', priority: 2 },
  { title: 'Facturar $5M', category: 'negocio', description: 'Revenue anual', metric: 'revenue', targetValue: '5000000', currentValue: '1250000', unit: 'ARS', priority: 1 },
  { title: 'Meditar 30 días seguidos', category: 'espiritual', description: 'Streak de meditación', metric: 'streak', targetValue: '30', currentValue: '16', unit: 'días', priority: 3 },
  { title: 'Correr 5K en < 25min', category: 'salud', description: 'Mejorar marca personal', metric: 'tiempo', targetValue: '25', currentValue: '28', unit: 'min', priority: 2 },
];

const goalIds: number[] = [];
for (const g of GOAL_DEFS) {
  const existing = existingGoals.find((e: any) => e.title === g.title);
  if (existing) {
    goalIds.push(existing.id);
  } else {
    const result = db.prepare(
      `INSERT INTO goals (user_id, title, category, description, metric, target_value, current_value, unit, priority, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    ).run(userId, g.title, g.category, g.description, g.metric, g.targetValue, g.currentValue, g.unit, g.priority, new Date().toISOString());
    goalIds.push(Number(result.lastInsertRowid));
  }
}
console.log(`Goals ready: ${goalIds.length} goals`);

// ── Seed daily entries for March 1-16 ───────────────────────

const TODAY_DAY = 16; // March 16, 2026

const exerciseTypes = ['Gym', 'Running', 'Calistenia', 'HIIT', 'Natación', 'Yoga'];
const emotionalStates = ['motivado', 'tranquilo', 'enfocado', 'cansado', 'contento', 'estresado', 'energético'];
const bigWins = [
  'Cerré un cliente grande', 'PR en sentadilla', 'Terminé un capítulo del libro',
  'Presentación excelente', 'Mejoré mi 5K', 'Día super productivo',
  'Buena sesión de estudio', 'Llamada exitosa con inversor', 'Medité 20 min sin interrupciones',
  'Cociné algo muy rico y sano', 'Organicé toda la semana', 'Me levanté a las 6am',
  'Completé todos los hábitos', 'Buena conversación con amigo', 'Avancé mucho en el proyecto',
  'Di un gran paso fuera de mi zona de confort',
];

console.log('Seeding daily entries...');
const insertEntry = db.prepare(`
  INSERT INTO daily_entries (user_id, date, sleep_quality, bedtime, wake_time, mood, emotional_state,
    energy_level, exercise_done, exercise_type, exercise_duration, diet_quality,
    focus_hours, tasks_completed, biggest_win, overall_score, day_rating, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let day = 1; day <= TODAY_DAY; day++) {
  const date = dateStr(2026, 3, day);
  const sleepQ = rand(5, 9);
  const mood = rand(5, 10);
  const energy = rand(4, 9);
  const didExercise = Math.random() > 0.2; // 80% chance
  const exType = didExercise ? pick(exerciseTypes) : null;
  const exDuration = didExercise ? rand(30, 90) : null;
  const dietQ = rand(5, 9);
  const focus = parseFloat((rand(20, 70) / 10).toFixed(1)); // 2.0 - 7.0
  const tasks = rand(3, 8);
  const dayRating = rand(6, 10);
  
  // Overall score calculation
  let score = 0, cnt = 0;
  score += sleepQ * 10; cnt++;
  score += mood * 10; cnt++;
  score += energy * 10; cnt++;
  if (didExercise) { score += 80; cnt++; }
  score += dietQ * 10; cnt++;
  score += dayRating * 10; cnt++;
  const overall = Math.round(score / cnt);

  const bedtime = `${rand(22, 23)}:${String(rand(0, 59)).padStart(2, '0')}`;
  const wakeTime = `${rand(6, 7)}:${String(rand(0, 59)).padStart(2, '0')}`;

  insertEntry.run(
    userId, date, sleepQ, bedtime, wakeTime, mood, pick(emotionalStates),
    energy, didExercise ? 1 : 0, exType, exDuration, dietQ,
    focus, tasks, pick(bigWins), overall, dayRating,
    new Date().toISOString(), new Date().toISOString()
  );
}
console.log(`  Created ${TODAY_DAY} daily entries`);

// ── Seed habit logs for March ───────────────────────────────

console.log('Seeding habit logs...');
const insertHabitLog = db.prepare(
  'INSERT OR IGNORE INTO habit_logs (habit_id, user_id, date, completed, created_at) VALUES (?, ?, ?, 1, ?)'
);

let habitLogCount = 0;
for (let day = 1; day <= TODAY_DAY; day++) {
  const date = dateStr(2026, 3, day);
  for (const habitId of habitIds) {
    // Each habit has a different completion rate
    const rate = 0.55 + Math.random() * 0.35; // 55%-90% completion rate
    if (Math.random() < rate) {
      insertHabitLog.run(habitId, userId, date, new Date().toISOString());
      habitLogCount++;
    }
  }
}
console.log(`  Created ${habitLogCount} habit logs`);

// ── Seed goal logs for March ────────────────────────────────

console.log('Seeding goal logs...');
const insertGoalLog = db.prepare(
  'INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

const goalActions = ['update', 'progress', 'milestone'];
let goalLogCount = 0;
for (let day = 1; day <= TODAY_DAY; day++) {
  const date = dateStr(2026, 3, day);
  // Random 1-3 goal progress entries per day
  const numLogs = rand(1, 3);
  for (let i = 0; i < numLogs; i++) {
    const goalId = pick(goalIds);
    insertGoalLog.run(
      goalId, userId, date, pick(goalActions),
      parseFloat((Math.random() * 2).toFixed(2)),
      null,
      new Date().toISOString()
    );
    goalLogCount++;
  }
}
console.log(`  Created ${goalLogCount} goal logs`);

// ── Seed messages for March ─────────────────────────────────

console.log('Seeding messages...');

const userMessages = [
  'Hoy entrené pecho y tríceps, me sentí muy bien',
  'Dormí 7 horas, me desperté descansado',
  'Dieta fue 8/10 hoy, cociné pollo a la plancha',
  'Tuve una reunión productiva con el equipo',
  'Me costó concentrarme hoy, muchas distracciones',
  'Hice 30 min de meditación',
  'Leí 20 páginas del libro nuevo',
  'Hoy fue un día excelente, completé todos mis pendientes',
  'Entrené piernas, hice sentadillas con 80kg',
  'No pude hacer ejercicio hoy, mucho trabajo',
  'Comí bastante bien, ensalada al mediodía',
  'Me levanté temprano y fui a correr 5km',
  'Tuve energía baja después del almuerzo',
  'Estudié 2 horas de marketing digital',
  'Hoy cerré un deal importante para el negocio',
  'Hice yoga a la mañana, me relajó mucho',
  'Dormí mal pero el día fue productivo igual',
  'Medité 15 min antes de dormir',
  'Tomé 2.5 litros de agua hoy',
  'Cené liviano, estoy intentando comer mejor',
];

const coachResponses = [
  '¡Genial! Constancia es clave. 💪 Tu progreso en el gym se nota.',
  'Buen descanso = mejor rendimiento. Seguí así con las rutinas de sueño.',
  'La dieta va por buen camino. ¿Querés que te sugiera recetas saludables?',
  'Productividad alta hoy. ¿Cómo te sentiste emocionalmente después de la reunión?',
  'Es normal tener días así. Lo importante es volver mañana con más fuerza.',
  'La meditación es un hábito transformador. ¿Sentiste diferencia durante el día?',
  '¡Muy bien! Cada página cuenta. ¿De qué trata el libro?',
  'Días así te acercan a tus metas. ¡Seguí con esa energía!',
  'PR en sentadillas! Tu progreso en fuerza es impresionante.',
  'No pasa nada, mañana volvés. El descanso también es parte del proceso.',
  'Buena alimentación + ejercicio = combinación ganadora.',
  '5K a la mañana. ¿En cuánto tiempo? Vamos que estás cerca de tu meta.',
  'Probá una caminata corta después del almuerzo, ayuda con la energía.',
  'El estudio es inversión. ¿Querés armar un plan de estudio más estructurado?',
  '¡Felicitaciones por el deal! Tu negocio crece, seguí metiendo.',
  'El yoga complementa muy bien tu rutina de entrenamiento.',
  'Resiliencia pura. La productividad no depende solo del sueño.',
  'La meditación antes de dormir mejora la calidad del sueño. ¡Seguí!',
  'Excelente hidratación. Es uno de los hábitos más subestimados.',
  'Cenar liviano es clave para dormir bien. ¡Bien ahí!',
];

const insertMessage = db.prepare(
  'INSERT INTO messages (user_id, direction, content_type, raw_content, timestamp) VALUES (?, ?, ?, ?, ?)'
);

let msgCount = 0;
for (let day = 1; day <= TODAY_DAY; day++) {
  const date = dateStr(2026, 3, day);
  // 2-4 message pairs per day
  const numPairs = rand(2, 4);
  for (let p = 0; p < numPairs; p++) {
    const hour = rand(7, 22);
    const min = rand(0, 59);
    // User message
    insertMessage.run(userId, 'in', 'text', pick(userMessages), isoTs(date, hour, min));
    // Coach response 1-3 min later
    insertMessage.run(userId, 'out', 'text', pick(coachResponses), isoTs(date, hour, min + rand(1, 3)));
    msgCount += 2;
  }
}
console.log(`  Created ${msgCount} messages`);

// ── Seed study sessions for March ───────────────────────────

console.log('Seeding study sessions...');
const methods = ['pomodoro', 'flow', 'flashcards', 'spaced_rep'];
const subjects = ['Marketing Digital', 'Finanzas Personales', 'Programación', 'Inglés', 'Liderazgo', 'Negociación'];

const insertStudy = db.prepare(`
  INSERT INTO study_sessions (user_id, date, method, subject, focus_minutes, break_minutes, cycles_completed, quality, started_at, ended_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let studyCount = 0;
for (let day = 1; day <= TODAY_DAY; day++) {
  const date = dateStr(2026, 3, day);
  // 60% chance of study session
  if (Math.random() < 0.6) {
    const method = pick(methods);
    const subject = pick(subjects);
    const focus = rand(25, 90);
    const breakMins = method === 'pomodoro' ? 5 : null;
    const cycles = method === 'pomodoro' ? rand(2, 6) : null;
    const quality = rand(5, 10);
    const startHour = rand(9, 20);
    const startMin = rand(0, 59);

    insertStudy.run(
      userId, date, method, subject, focus, breakMins, cycles, quality,
      isoTs(date, startHour, startMin),
      isoTs(date, startHour + Math.ceil(focus / 60), startMin),
      new Date().toISOString()
    );
    studyCount++;
  }
}
console.log(`  Created ${studyCount} study sessions`);

// ── Seed patterns / correlations ────────────────────────────

console.log('Seeding patterns...');
const insertPattern = db.prepare(`
  INSERT INTO patterns (user_id, pattern_type, area_a, area_b, description, correlation, data_points, confidence, active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
`);

const patternDefs = [
  { areaA: 'sleep', areaB: 'mood', desc: 'Dormir bien mejora tu estado de ánimo al día siguiente', corr: 0.72, points: 14, conf: 0.85 },
  { areaA: 'exercise', areaB: 'energy', desc: 'Los días que entrenás tenés más energía', corr: 0.65, points: 12, conf: 0.78 },
  { areaA: 'diet', areaB: 'focus', desc: 'Buena alimentación se correlaciona con más horas de foco', corr: 0.58, points: 11, conf: 0.7 },
  { areaA: 'mood', areaB: 'productivity', desc: 'Tu productividad sube cuando tu mood es alto', corr: 0.81, points: 15, conf: 0.92 },
  { areaA: 'sleep', areaB: 'exercise', desc: 'Buen descanso = mejor rendimiento en el gym', corr: 0.55, points: 10, conf: 0.65 },
];

for (const p of patternDefs) {
  insertPattern.run(userId, 'correlation', p.areaA, p.areaB, p.desc, p.corr, p.points, p.conf, new Date().toISOString(), new Date().toISOString());
}
console.log(`  Created ${patternDefs.length} patterns`);

// ── Done ────────────────────────────────────────────────────

db.close();
console.log('\n✅ March 2026 test data seeded successfully!');
console.log(`Summary:
  - ${TODAY_DAY} daily entries
  - ${habitIds.length} habits with ${habitLogCount} logs
  - ${goalIds.length} goals with ${goalLogCount} logs
  - ${msgCount} messages
  - ${studyCount} study sessions
  - ${patternDefs.length} correlation patterns
`);
