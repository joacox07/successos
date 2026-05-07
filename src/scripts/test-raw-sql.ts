import { getDb, getSqlite } from '../db/client.js';

// Initialize DB
getDb();

const sqlite = getSqlite();
if (!sqlite) {
  console.error('DB not ready');
  process.exit(1);
}

async function test() {
  console.log('🧪 Testing diary data with raw SQL...\n');

  const userId = 1;
  const dates = ['2026-03-21', '2026-03-22', '2026-03-23'];

  for (const date of dates) {
    console.log(`\n📅 ${date}:`);

    // Entry
    const entry = sqlite.prepare('SELECT * FROM daily_entries WHERE user_id = ? AND date = ?').get(userId, date) as any;
    console.log(`  Entry: ${entry ? '✅' : '❌'}`);
    if (entry) {
      console.log(`    - mood: ${entry.mood}`);
      console.log(`    - biggestWin: ${entry.biggest_win}`);
    }

    // Messages
    try {
      const [y, m, d] = date.split('-').map(Number);
      const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
      const nextDayStr = nextDay.toISOString().slice(0, 10);

      const messages = sqlite.prepare(`
        SELECT id, direction, content_type, raw_content, timestamp FROM messages
        WHERE user_id = ? AND timestamp >= ? AND timestamp < ?
      `).all(userId, `${date}T03:00:00Z`, `${nextDayStr}T03:00:00Z`) as any[];

      console.log(`  Messages: ${messages.length}`);
    } catch (err) {
      console.log(`  Messages: ❌ ${err}`);
    }

    // Habits
    try {
      const habits = sqlite.prepare(`
        SELECT h.id AS habit_id, h.name, h.emoji,
               COALESCE(hl.completed, 0) AS completed
        FROM habits h
        LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ? AND hl.user_id = ?
        WHERE h.user_id = ? AND h.active = 1
      `).all(date, userId, userId) as any[];

      console.log(`  Habits: ${habits.length}`);
    } catch (err) {
      console.log(`  Habits: ❌ ${err}`);
    }

    // Goals
    try {
      const goals = sqlite.prepare(`
        SELECT id, title FROM goals
        WHERE user_id = ? AND status = 'active'
      `).all(userId) as any[];

      console.log(`  Goals: ${goals.length}`);
    } catch (err) {
      console.log(`  Goals: ❌ ${err}`);
    }
  }

  console.log('\n✅ Test complete');
  process.exit(0);
}

test().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
