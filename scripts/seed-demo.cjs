const Database = require('better-sqlite3');
const db = new Database('./data/successos.db');
db.pragma('journal_mode = WAL');

// ── 1. HABITS ──
const insertHabit = db.prepare('INSERT INTO habits (user_id, name, emoji, category, frequency) VALUES (1, ?, ?, ?, ?)');
const habits = [
  ['Gym', '💪', 'salud', 'daily'],
  ['Meditar', '🧘', 'salud', 'daily'],
  ['Leer 30 min', '📚', 'personal', 'daily'],
  ['No redes sociales', '📵', 'productividad', 'daily'],
  ['Rezar', '🙏', 'espiritual', 'daily'],
  ['Journaling', '📝', 'personal', 'daily'],
];
const habitIds = [];
for (const h of habits) {
  const r = insertHabit.run(...h);
  habitIds.push(Number(r.lastInsertRowid));
}
console.log('Habits created:', habitIds);

// ── 2. HABIT LOGS (last 30 days) ──
const insertHabitLog = db.prepare('INSERT OR IGNORE INTO habit_logs (habit_id, user_id, date, completed) VALUES (?, 1, ?, ?)');
const today = new Date('2026-03-12');
for (let d = 0; d < 30; d++) {
  const date = new Date(today);
  date.setDate(date.getDate() - d);
  const ds = date.toISOString().slice(0, 10);
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  for (let i = 0; i < habitIds.length; i++) {
    const baseProb = 0.5 + (30 - d) * 0.015;
    let prob = baseProb;
    if (isWeekend) prob -= 0.2;
    if (i === 0) prob = isWeekend ? 0.3 : 0.85; // Gym: skip weekends
    if (i === 3) prob -= 0.15; // No redes is hard
    const completed = Math.random() < prob ? 1 : 0;
    insertHabitLog.run(habitIds[i], ds, completed);
  }
}
console.log('Habit logs inserted');

// ── 3. MESSAGES (2-5 per day, last 30 days) ──
const insertMsg = db.prepare('INSERT INTO messages (user_id, direction, content_type, raw_content, timestamp) VALUES (1, ?, ?, ?, ?)');
const userMsgs = [
  'Hoy fui al gym, hice pecho y triceps',
  'Me desperte a las 6:30, buen suenio',
  'Medite 15 min',
  'Hoy no pude ir al gym, me quede dormido',
  'Lei 40 paginas del libro de Atomic Habits',
  'Hoy comi bastante bien, almuerzo saludable',
  'Me siento con mucha energia hoy',
  'Tuve un dia medio flojo, cero ganas',
  'Estudie 2 horas para el parcial',
  'Gym pesado hoy, subi peso en sentadilla',
  'Ayer me acoste re tarde scrolleando',
  'Hoy ayune hasta las 12',
  'Corri 5k en 28 minutos',
  'Tuve reunion con cliente, salio bien',
  'Termine el capitulo 5 del libro',
  'Hoy fue un dia 10/10',
  'Me siento frustrado con el progreso',
  'Hice journaling por primera vez en la semana',
  'Cene con amigos, comi pizza',
  'Labure 6 horas seguidas en el proyecto',
];
const coachMsgs = [
  'Muy bien Joaquin! Constancia es la clave. Llevas 3 dias seguidos entrenando.',
  'Excelente que hayas meditado. La evidencia muestra que incluso 10 min diarios reducen cortisol un 25%.',
  'No te preocupes por un dia flojo. Lo importante es la tendencia, no el dia individual.',
  'Tu promedio de suenio mejoro esta semana. Segui asi con el horario.',
  'Vi que estas leyendo mas. Llevas 7 libros, vas bien para tu objetivo de 24.',
  'Buena sesion de estudio! El metodo Pomodoro te esta funcionando bien.',
  'Tu score de hoy fue 82/100. Arriba del promedio semanal de 71.',
  'Cuidado con las redes sociales antes de dormir - correlaciona con peor suenio al dia siguiente.',
  'Felicitaciones por el PR en gym! Tu consistencia en las ultimas 2 semanas se nota.',
  'Tu dieta mejoro bastante esta semana. 7.2 promedio vs 5.8 la semana pasada.',
];

for (let d = 0; d < 30; d++) {
  const date = new Date(today);
  date.setDate(date.getDate() - d);
  const ds = date.toISOString().slice(0, 10);
  const numMsgs = 2 + Math.floor(Math.random() * 4);

  for (let m = 0; m < numMsgs; m++) {
    const isUser = m % 2 === 0;
    const hour = 7 + Math.floor(Math.random() * 14);
    const min = Math.floor(Math.random() * 60);
    const ts = ds + 'T' + String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':00';

    if (isUser) {
      const msg = userMsgs[Math.floor(Math.random() * userMsgs.length)];
      insertMsg.run('in', 'text', msg, ts);
    } else {
      const msg = coachMsgs[Math.floor(Math.random() * coachMsgs.length)];
      insertMsg.run('out', 'text', msg, ts);
    }
  }
}
console.log('Messages inserted');

// ── 4. GOAL LOGS ──
const insertGoalLog = db.prepare('INSERT INTO goal_logs (goal_id, user_id, date, action, value_change, note) VALUES (?, 1, ?, ?, ?, ?)');
const goalNotes = {
  1: ['Cerre un cliente nuevo', 'Facture proyecto freelance', 'Cobre cuota mensual', 'Nuevo lead calificado'],
  2: ['Gym + dieta limpia', 'Cardio 30 min', 'Buen dia de corte', 'Pesaje semanal'],
  3: ['Transferi a ahorro', 'Me pagaron proyecto', 'Guarde diferencia del mes'],
  4: ['Termine otro libro', 'Lei 2 capitulos', 'Empece libro nuevo'],
  5: ['Medite hoy', 'Sesion de 15 min', 'Medite en la maniana'],
};

for (let d = 0; d < 30; d++) {
  const date = new Date(today);
  date.setDate(date.getDate() - d);
  const ds = date.toISOString().slice(0, 10);

  for (let gid = 1; gid <= 5; gid++) {
    if (Math.random() < 0.43) {
      const notes = goalNotes[gid];
      const note = notes[Math.floor(Math.random() * notes.length)];
      let valueChange;
      switch (gid) {
        case 1: valueChange = Math.floor(Math.random() * 200000) + 50000; break;
        case 2: valueChange = -(Math.random() * 0.3 + 0.05); break;
        case 3: valueChange = Math.floor(Math.random() * 150) + 20; break;
        case 4: valueChange = Math.random() < 0.3 ? 1 : 0; break;
        case 5: valueChange = 1; break;
      }
      insertGoalLog.run(gid, ds, 'progress', valueChange, note);
    }
  }
}
console.log('Goal logs inserted');

// ── 5. STUDY SESSIONS ──
const insertStudy = db.prepare('INSERT INTO study_sessions (user_id, date, method, subject, focus_minutes, break_minutes, cycles_completed, quality, started_at, ended_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const subjects = ['Analisis Matematico II', 'Fisica II', 'Programacion', 'Algebra', 'Economia'];
const methods = ['pomodoro', 'deep-work', 'active-recall', 'spaced-repetition'];

for (let d = 0; d < 30; d++) {
  const date = new Date(today);
  date.setDate(date.getDate() - d);
  const ds = date.toISOString().slice(0, 10);
  const dow = date.getDay();

  if (dow === 0 || dow === 6) { if (Math.random() > 0.3) continue; }
  else { if (Math.random() > 0.7) continue; }

  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const method = methods[Math.floor(Math.random() * methods.length)];
  const focusMin = [25, 45, 50, 60, 90][Math.floor(Math.random() * 5)];
  const breakMin = method === 'pomodoro' ? 5 : 10;
  const cycles = method === 'pomodoro' ? Math.floor(focusMin / 25) : 1;
  const quality = 5 + Math.floor(Math.random() * 5);
  const startHour = 14 + Math.floor(Math.random() * 6);
  const startTs = ds + 'T' + String(startHour).padStart(2, '0') + ':00:00';
  const endMin = Math.min(focusMin, 59);
  const endTs = ds + 'T' + String(startHour).padStart(2, '0') + ':' + String(endMin).padStart(2, '0') + ':00';

  insertStudy.run(ds, method, subject, focusMin, breakMin, cycles, quality, startTs, endTs);
}
console.log('Study sessions inserted');

// Verify
console.log('\n=== TOTALES ===');
console.log('daily_entries:', db.prepare('SELECT COUNT(*) as c FROM daily_entries WHERE user_id=1').get());
console.log('messages:', db.prepare('SELECT COUNT(*) as c FROM messages WHERE user_id=1').get());
console.log('habits:', db.prepare('SELECT COUNT(*) as c FROM habits WHERE user_id=1').get());
console.log('habit_logs:', db.prepare('SELECT COUNT(*) as c FROM habit_logs WHERE user_id=1').get());
console.log('goal_logs:', db.prepare('SELECT COUNT(*) as c FROM goal_logs WHERE user_id=1').get());
console.log('study_sessions:', db.prepare('SELECT COUNT(*) as c FROM study_sessions WHERE user_id=1').get());

db.close();
console.log('\nDone!');
