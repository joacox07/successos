import { getDb } from '../db/client.js';
import { dailyEntries } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();

async function checkData() {
  console.log('🔍 Checking daily entries for user 1...\n');

  const entries = await db
    .select()
    .from(dailyEntries)
    .where(eq(dailyEntries.userId, 1))
    .orderBy(dailyEntries.date)
    .limit(20);

  if (entries.length === 0) {
    console.log('❌ NO ENTRIES FOUND');
  } else {
    console.log(`✅ Found ${entries.length} entries:\n`);
    entries.forEach((e) => {
      console.log(`📅 ${e.date}`);
      console.log(`   Mood: ${e.mood}, Energy: ${e.energyLevel}, Sleep: ${e.sleepQuality}`);
      console.log(`   Biggest Win: ${e.biggestWin}`);
      console.log('');
    });
  }

  process.exit(0);
}

checkData().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
