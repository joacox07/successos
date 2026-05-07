import { getDb } from '../db/client.js';
import { dailyEntries, messages } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const userId = 1;

const wins = [
  'Completé el proyecto importante',
  'Entrené 1 hora sin parar',
  'Tuve una conversación productiva',
  'Aprendí algo nuevo y valioso',
  'Pasé tiempo con familia',
  'Terminé un capítulo del libro',
  'Mejoré mi récord personal',
  'Resolví un problema difícil',
  'Ayudé a alguien',
  'Me sentí en flow todo el día',
  'Avancé en el negocio',
  'Meditación profunda',
  'Comida muy saludable',
  'Dormí 8 horas perfectas',
  'Sin procrastinación hoy',
];

const messages_sample = [
  'Dormí bien, me levantó con energía',
  'Buen entrenamiento hoy',
  'Trabajé enfocado toda la mañana',
  'Medité 20 minutos',
  'Leí un capítulo del libro',
  'Comí saludable',
  'Pasé tiempo en familia',
  'Me siento productivo',
  'Día tranquilo y positivo',
  'Gym session intensa',
  'Trabajé 6 horas concentrado',
  'Sin estrés hoy',
];

async function seedMarch() {
  console.log('🌱 Seeding full March 2026 data...\n');

  for (let day = 1; day <= 23; day++) {
    const dateStr = `2026-03-${String(day).padStart(2, '0')}`;

    // Check if exists
    const existing = await db
      .select()
      .from(dailyEntries)
      .where(eq(dailyEntries.userId, userId))
      .where(eq(dailyEntries.date, dateStr));

    if (existing.length > 0) {
      console.log(`⏭️  ${dateStr} - already exists`);
      continue;
    }

    // Generate realistic data
    const sleepQuality = Math.floor(Math.random() * 4) + 6; // 6-10
    const energyLevel = Math.floor(Math.random() * 4) + 6;
    const mood = Math.floor(Math.random() * 4) + 6;
    const focusHours = Math.random() * 3 + 5; // 5-8
    const dayRating = Math.floor(Math.random() * 4) + 6;
    const exerciseDone = Math.random() > 0.3;
    const procrastination = Math.random() > 0.8;

    try {
      await db.insert(dailyEntries).values({
        userId,
        date: dateStr,
        bedtime: `${22 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        wakeTime: `${6 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        sleepQuality,
        sleepNote: `Sueño ${sleepQuality}/10`,
        energyLevel,
        energyNote: `Energía ${energyLevel}/10`,
        exerciseDone,
        exerciseType: exerciseDone ? (Math.random() > 0.5 ? 'Gym' : 'Running') : null,
        exerciseDuration: exerciseDone ? (Math.random() > 0.5 ? 60 : 45) : null,
        exerciseNote: exerciseDone ? 'Buen entrenamiento' : null,
        dietQuality: Math.floor(Math.random() * 3) + 7,
        dietNote: 'Comidas balanceadas',
        mood,
        emotionalState: mood > 8 ? 'Excelente' : mood > 6 ? 'Bien' : 'Neutral',
        emotionalNote: `Humor: ${mood}/10`,
        focusHours,
        tasksCompleted: Math.floor(Math.random() * 4) + 2,
        procrastination,
        biggestWin: wins[Math.floor(Math.random() * wins.length)],
        overallScore: dayRating,
        dayRating,
      });

      // Add 1-3 messages for the day
      const msgCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < msgCount; i++) {
        const hour = 7 + Math.floor(Math.random() * 15);
        const minute = Math.floor(Math.random() * 60);
        const msg = messages_sample[Math.floor(Math.random() * messages_sample.length)];

        const date = new Date(2026, 2, day); // Mar is month 2 (0-indexed)
        date.setHours(hour, minute, 0, 0);
        const timestamp = date.toISOString();

        await db.insert(messages).values({
          userId,
          direction: 'in',
          contentType: 'text',
          rawContent: msg,
          timestamp,
        });
      }

      console.log(`✅ ${dateStr} - created`);
    } catch (err) {
      console.error(`❌ ${dateStr} - error:`, err);
    }
  }

  console.log('\n✨ March seeding complete!');
  process.exit(0);
}

seedMarch().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
