import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: InstanceType<typeof Database> | null = null;

function ensureTables(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      name TEXT,
      username TEXT UNIQUE,
      timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
      onboarding_complete INTEGER DEFAULT 0,
      onboarding_step INTEGER DEFAULT 0,
      morning_check_in TEXT DEFAULT '07:00',
      evening_check_in TEXT DEFAULT '22:00',
      default_checkin_day_mode TEXT DEFAULT 'today',
      password_hash TEXT,
      password_salt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      life_context TEXT,
      obstacles TEXT,
      raw_answers TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      metric TEXT,
      target_value TEXT,
      current_value TEXT DEFAULT '0',
      unit TEXT,
      deadline TEXT,
      status TEXT DEFAULT 'active',
      priority INTEGER DEFAULT 3,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      goal_progress TEXT,
      bedtime TEXT,
      wake_time TEXT,
      sleep_quality INTEGER,
      sleep_note TEXT,
      energy_level INTEGER,
      energy_note TEXT,
      exercise_done INTEGER,
      exercise_type TEXT,
      exercise_duration INTEGER,
      exercise_note TEXT,
      diet_entries TEXT,
      diet_quality INTEGER,
      diet_note TEXT,
      mood INTEGER,
      emotional_state TEXT,
      emotional_note TEXT,
      focus_hours REAL,
      tasks_completed INTEGER,
      procrastination INTEGER,
      biggest_win TEXT,
      productivity_note TEXT,
      social_event TEXT,
      relationships_note TEXT,
      vices_details TEXT,
      vices_note TEXT,
      overall_score INTEGER,
      day_rating INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS daily_entries_user_date_idx ON daily_entries(user_id, date);

    CREATE TABLE IF NOT EXISTS goal_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL REFERENCES goals(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      action TEXT,
      value_change REAL,
      note TEXT,
      extracted_from INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS goal_logs_user_date_idx ON goal_logs(user_id, date);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      direction TEXT NOT NULL,
      content_type TEXT NOT NULL,
      raw_content TEXT,
      extracted_data TEXT,
      tokens INTEGER,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS messages_user_timestamp_idx ON messages(user_id, timestamp);

    CREATE TABLE IF NOT EXISTS action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      undo_token TEXT NOT NULL UNIQUE,
      action_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      reversible_until TEXT NOT NULL,
      undone INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS action_logs_user_created_idx ON action_logs(user_id, created_at);

    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      pattern_type TEXT NOT NULL,
      area_a TEXT NOT NULL,
      area_b TEXT NOT NULL,
      description TEXT,
      correlation REAL,
      data_points INTEGER,
      confidence REAL,
      related_goal_id INTEGER REFERENCES goals(id),
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      report_type TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      content TEXT,
      data_snapshot TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS onboarding_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      step INTEGER NOT NULL DEFAULT 0,
      data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS onboarding_state_user_idx ON onboarding_state(user_id);

    CREATE TABLE IF NOT EXISTS pending_habit_minutes_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      habit_id INTEGER NOT NULL REFERENCES habits(id),
      target_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS pending_habit_minutes_state_user_idx ON pending_habit_minutes_state(user_id);

    CREATE TABLE IF NOT EXISTS sent_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      checkin_type TEXT NOT NULL,
      date TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS sent_checkins_unique_idx ON sent_checkins(user_id, checkin_type, date);

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      emoji TEXT,
      category TEXT,
      frequency TEXT DEFAULT 'daily',
      is_negative INTEGER DEFAULT 0,
      target_minutes INTEGER,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS habits_user_idx ON habits(user_id);

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL REFERENCES habits(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 1,
      status TEXT DEFAULT 'positive',
      minutes_logged INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS habit_logs_unique_idx ON habit_logs(habit_id, date);
    CREATE INDEX IF NOT EXISTS habit_logs_user_date_idx ON habit_logs(user_id, date);

    CREATE TABLE IF NOT EXISTS habit_competitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by_user_id INTEGER REFERENCES users(id),
      created_by_mode TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS competition_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL REFERENCES habit_competitions(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL DEFAULT 'member',
      invite_status TEXT NOT NULL DEFAULT 'pending',
      joined_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS competition_participants_unique_idx ON competition_participants(competition_id, user_id);
    CREATE INDEX IF NOT EXISTS competition_participants_competition_idx ON competition_participants(competition_id);
    CREATE INDEX IF NOT EXISTS competition_participants_user_idx ON competition_participants(user_id);

    CREATE TABLE IF NOT EXISTS competition_habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL REFERENCES habit_competitions(id),
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      kind TEXT NOT NULL DEFAULT 'event',
      scoring_mode TEXT NOT NULL DEFAULT 'positive_only',
      points_positive INTEGER NOT NULL DEFAULT 1,
      points_negative INTEGER NOT NULL DEFAULT 0,
      minutes_per_block INTEGER,
      points_per_block INTEGER,
      daily_target_minutes INTEGER,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS competition_habits_competition_idx ON competition_habits(competition_id);

    CREATE TABLE IF NOT EXISTS competition_habit_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_habit_id INTEGER NOT NULL REFERENCES competition_habits(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      personal_habit_id INTEGER NOT NULL REFERENCES habits(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS competition_habit_links_unique_idx ON competition_habit_links(competition_habit_id, user_id);
    CREATE INDEX IF NOT EXISTS competition_habit_links_habit_idx ON competition_habit_links(competition_habit_id);
    CREATE INDEX IF NOT EXISTS competition_habit_links_user_idx ON competition_habit_links(user_id);

    CREATE TABLE IF NOT EXISTS competition_habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_habit_id INTEGER NOT NULL REFERENCES competition_habits(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'positive',
      minutes_logged INTEGER DEFAULT 0,
      points_awarded INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS competition_habit_logs_unique_idx ON competition_habit_logs(competition_habit_id, user_id, date);
    CREATE INDEX IF NOT EXISTS competition_habit_logs_habit_date_idx ON competition_habit_logs(competition_habit_id, date);
    CREATE INDEX IF NOT EXISTS competition_habit_logs_user_date_idx ON competition_habit_logs(user_id, date);

    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      method TEXT NOT NULL,
      subject TEXT,
      focus_minutes INTEGER NOT NULL,
      break_minutes INTEGER,
      cycles_completed INTEGER,
      cards_reviewed INTEGER,
      quality INTEGER,
      note TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS study_sessions_user_date_idx ON study_sessions(user_id, date);

    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      emoji TEXT,
      card_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS flashcard_decks_user_idx ON flashcard_decks(user_id);

    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id),
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      ease_factor REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 0,
      next_review TEXT,
      repetitions INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS flashcards_deck_idx ON flashcards(deck_id);
    CREATE INDEX IF NOT EXISTS flashcards_review_idx ON flashcards(next_review);

    CREATE TABLE IF NOT EXISTS study_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      last_studied TEXT,
      next_review TEXT,
      review_stage INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS study_subjects_user_idx ON study_subjects(user_id);

    CREATE TABLE IF NOT EXISTS calendar_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expiry_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS calendar_tokens_user_idx ON calendar_tokens(user_id);
  `);

  // Migrations: add columns that may be missing from older DBs
  const migrations = [
    "ALTER TABLE users ADD COLUMN email TEXT",
    "ALTER TABLE users ADD COLUMN profile_complete INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN username TEXT",
    "ALTER TABLE users ADD COLUMN default_checkin_day_mode TEXT DEFAULT 'today'",
    "ALTER TABLE habits ADD COLUMN is_negative INTEGER DEFAULT 0",
    "ALTER TABLE habits ADD COLUMN target_minutes INTEGER",
    "ALTER TABLE habit_logs ADD COLUMN status TEXT DEFAULT 'positive'",
    "ALTER TABLE pending_habit_minutes_state ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
    "ALTER TABLE habit_logs ADD COLUMN minutes_logged INTEGER DEFAULT 0",
    "ALTER TABLE competition_habits ADD COLUMN kind TEXT NOT NULL DEFAULT 'event'",
    "ALTER TABLE competition_habits ADD COLUMN minutes_per_block INTEGER",
    "ALTER TABLE competition_habits ADD COLUMN points_per_block INTEGER",
    "ALTER TABLE competition_habits ADD COLUMN daily_target_minutes INTEGER",
    "ALTER TABLE competition_habit_logs ADD COLUMN minutes_logged INTEGER DEFAULT 0",
    "ALTER TABLE competition_habit_logs ADD COLUMN points_awarded INTEGER DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  const postMigrations = [
    "CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username)",
    "UPDATE users SET default_checkin_day_mode = 'today' WHERE default_checkin_day_mode IS NULL OR trim(default_checkin_day_mode) = ''",
    "UPDATE habit_logs SET status = CASE WHEN completed = 1 THEN 'positive' ELSE 'clear' END WHERE status IS NULL",
    "UPDATE habit_logs SET minutes_logged = 0 WHERE minutes_logged IS NULL",
    "UPDATE competition_habits SET kind = 'event' WHERE kind IS NULL OR trim(kind) = ''",
    "UPDATE competition_habit_logs SET minutes_logged = 0 WHERE minutes_logged IS NULL",
    "UPDATE competition_habit_logs SET points_awarded = 0 WHERE points_awarded IS NULL",
  ];
  for (const sql of postMigrations) {
    try { db.exec(sql); } catch { /* ignore */ }
  }
}

export function getDb() {
  if (!db) {
    db = initDb();
  }
  return db;
}

export function initDb() {
  mkdirSync(dirname(config.dbPath), { recursive: true });
  sqlite = new Database(config.dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');

  // Auto-create all tables
  ensureTables(sqlite);

  db = drizzle(sqlite, { schema });
  logger.info('Database connected and tables verified');
  return db;
}

export function getSqlite() {
  return sqlite;
}
