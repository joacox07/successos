import { getDb } from '../db/client.js';
import { dailyEntries, messages, habits, habitLogs, goals } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const db = getDb();
const userId = 1;

async function testDayLoad(date: string) {
  console.log(`\n🧪 Testing day data load for ${date}...\n`);

  // Simulate endpoint logic exactly
  try {
    // Get entry
    const entry = await db
      .select()
      .from(dailyEntries)
      .where(and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date)))
      .limit(1);

    console.log(`Entry: ${entry.length > 0 ? '✅' : '❌'}`);
    if (entry.length > 0) {
      const e = entry[0];
      console.log(`  - mood: ${e.mood}`);
      console.log(`  - energyLevel: ${e.energyLevel}`);
      console.log(`  - biggestWin: ${e.biggestWin}`);
    }

    // Get messages for that day
    const [y, m, d] = date.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
    const nextDayStr = nextDay.toISOString().slice(0, 10);

    const msgs = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          ...([] as any) // Simplified - just get all messages for the day
        )
      );

    console.log(`Messages: ${msgs.length}`);

    // Get habits with completion status
    const habitsData = await db
      .select()
      .from(habits)
      .where(eq(habits.userId, userId));

    console.log(`Habits: ${habitsData.length}`);

    // Get goals
    const goalsData = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.status, 'active')));

    console.log(`Goals: ${goalsData.length}`);

    // Check if has data
    const hasData = entry.length > 0 || msgs.length > 0 || habitsData.length > 0 || goalsData.length > 0;
    console.log(`\n📊 Has data: ${hasData ? '✅ YES' : '❌ NO'}`);

    if (!hasData) {
      console.log('\n⚠️  Empty state would show for this day');
    }
  } catch (err) {
    console.error('ERROR:', err);
  }
}

async function main() {
  const dates = ['2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24'];

  for (const date of dates) {
    await testDayLoad(date);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
