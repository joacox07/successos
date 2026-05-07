import { getDb } from '../db/client.js';
import { dailyEntries, messages } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const userId = 1; // Ajusta esto al ID del usuario actual

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTimestamp(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const sampleMessages = [
  { text: 'Buenos días! Dormí bien', hour: 7, minute: 30 },
  { text: 'Tuve un buen entrenamiento hoy, 1 hora de gym', hour: 18, minute: 0 },
  { text: 'Trabajé 6 horas enfocado', hour: 17, minute: 0 },
  { text: 'Meditación de 20 min para empezar el día', hour: 7, minute: 15 },
  { text: 'Leí durante 30 minutos antes de dormir', hour: 22, minute: 0 },
  { text: 'Caminata al parque con un amigo', hour: 19, minute: 30 },
  { text: 'Comida balanceada: pollo, arroz integral y verduras', hour: 12, minute: 30 },
  { text: 'Día productivo! Completé todos los objetivos', hour: 18, minute: 0 },
  { text: 'Descansé bien, sin estrés hoy', hour: 20, minute: 0 },
  { text: 'Mucho estrés en el trabajo, pero lo logré', hour: 17, minute: 0 },
];

async function seedDiary() {
  console.log('🌱 Seeding diary with 7 days of test data...');

  try {
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const dateStr = getDateStr(daysAgo);
      console.log(`📅 Creating data for ${dateStr}...`);

      // Check if entry already exists
      const existing = await db
        .select()
        .from(dailyEntries)
        .where(eq(dailyEntries.userId, userId))
        .where(eq(dailyEntries.date, dateStr))
        .limit(1);

      if (existing.length > 0) {
        console.log(`   ⏭️  Entry already exists, skipping`);
        continue;
      }

      // Create daily entry with realistic data
      const sleepQuality = Math.floor(Math.random() * 3) + 7; // 7-10
      const energyLevel = Math.floor(Math.random() * 3) + 7;
      const mood = Math.floor(Math.random() * 3) + 7;
      const focusHours = Math.random() * 2 + 5; // 5-7 hours
      const dayRating = Math.floor(Math.random() * 3) + 7; // 7-10

      await db.insert(dailyEntries).values({
        userId,
        date: dateStr,
        bedtime: '23:00',
        wakeTime: '07:00',
        sleepQuality,
        sleepNote: sleepQuality > 8 ? 'Dormi muy bien' : 'Dormir normal',
        energyLevel,
        energyNote: `Energía ${energyLevel}/10`,
        exerciseDone: Math.random() > 0.3,
        exerciseType: Math.random() > 0.5 ? 'Gym' : 'Running',
        exerciseDuration: Math.random() > 0.5 ? 60 : 45,
        exerciseNote: 'Buen entrenamiento',
        dietQuality: Math.floor(Math.random() * 3) + 7,
        dietNote: 'Comidas balanceadas',
        mood,
        emotionalState: mood > 8 ? 'Feliz' : mood > 6 ? 'Bien' : 'Neutral',
        emotionalNote: `Humor ${mood}/10`,
        focusHours,
        tasksCompleted: Math.floor(Math.random() * 3) + 3,
        procrastination: Math.random() > 0.7,
        biggestWin: ['Completé el proyecto', 'Tuve una reunión productiva', 'Aprendí algo nuevo', 'Pasé tiempo de calidad'][
          Math.floor(Math.random() * 4)
        ],
        overallScore: dayRating,
        dayRating,
      });

      // Add 2-3 random chat messages for the day
      const messageCount = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < messageCount; i++) {
        const sample = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
        const timestamp = getTimestamp(daysAgo, sample.hour, sample.minute);

        await db.insert(messages).values({
          userId,
          direction: 'in',
          contentType: 'text',
          rawContent: sample.text,
          timestamp,
        });
      }

      console.log(`   ✅ Data created`);
    }

    console.log('✨ Seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding:', error);
    process.exit(1);
  }
}

seedDiary().then(() => process.exit(0));
