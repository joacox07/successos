import { getDb } from '../db/client.js';
import { dailyEntries } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();

async function testEndpoint() {
  console.log('🧪 Testing /day/:date endpoint logic...\n');

  const userId = 1;
  const testDate = '2026-03-22';

  console.log(`Testing date: ${testDate}, userId: ${userId}\n`);

  // Simulate the endpoint logic
  const entry = await db
    .select()
    .from(dailyEntries)
    .where(eq(dailyEntries.userId, userId))
    .where(eq(dailyEntries.date, testDate));

  console.log('Entry result:');
  if (entry.length === 0) {
    console.log('❌ NO ENTRY FOUND');
  } else {
    const e = entry[0];
    console.log(`✅ Entry found:
      date: ${e.date}
      mood: ${e.mood}
      energy: ${e.energyLevel}
      sleep: ${e.sleepQuality}
      biggestWin: ${e.biggestWin}
      overallScore: ${e.overallScore}
    `);
  }

  // Test a few more dates
  console.log('\n📊 Testing multiple dates:');
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    const result = await db
      .select()
      .from(dailyEntries)
      .where(eq(dailyEntries.userId, userId))
      .where(eq(dailyEntries.date, dateStr));

    const status = result.length > 0 ? '✅' : '❌';
    const mood = result.length > 0 ? result[0].mood : 'N/A';
    console.log(`${status} ${dateStr}: mood=${mood}`);
  }

  process.exit(0);
}

testEndpoint().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
