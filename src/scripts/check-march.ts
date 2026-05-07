import { getDb } from '../db/client.js';
import { dailyEntries } from '../db/schema.js';
import { eq, gte, lte } from 'drizzle-orm';

const db = getDb();

async function checkMarch() {
  console.log('🔍 Checking March 2026 data...\n');

  const entries = await db
    .select()
    .from(dailyEntries)
    .where(eq(dailyEntries.userId, 1))
    .where(gte(dailyEntries.date, '2026-03-16'))
    .where(lte(dailyEntries.date, '2026-03-22'))
    .orderBy(dailyEntries.date);

  console.log(`Found ${entries.length} entries for Mar 16-22:\n`);

  if (entries.length === 0) {
    console.log('❌ NO MARCH DATA - need to seed');
  } else {
    entries.forEach((e) => {
      console.log(`${e.date}: mood=${e.mood}, energy=${e.energyLevel}, win=${e.biggestWin}`);
    });
  }

  process.exit(0);
}

checkMarch().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
