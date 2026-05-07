import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phone: text('phone').notNull().unique(),
  name: text('name'),
  username: text('username'),
  timezone: text('timezone').default('America/Argentina/Buenos_Aires'),
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' }).default(false),
  onboardingStep: integer('onboarding_step').default(0),
  morningCheckIn: text('morning_check_in').default('07:00'),
  eveningCheckIn: text('evening_check_in').default('22:00'),
  defaultCheckinDayMode: text('default_checkin_day_mode').default('today'),
  passwordHash: text('password_hash'),
  passwordSalt: text('password_salt'),
  email: text('email'),
  profileComplete: integer('profile_complete', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
}));

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  lifeContext: text('life_context', { mode: 'json' }),
  obstacles: text('obstacles', { mode: 'json' }),
  rawAnswers: text('raw_answers', { mode: 'json' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  category: text('category').notNull(), // negocio, salud, personal, finanzas, relaciones
  description: text('description'),
  metric: text('metric'), // qué se mide
  targetValue: text('target_value'),
  currentValue: text('current_value').default('0'),
  unit: text('unit'),
  deadline: text('deadline'),
  status: text('status').default('active'), // active, completed, paused
  priority: integer('priority').default(3), // 1-5
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const dailyEntries = sqliteTable('daily_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(), // YYYY-MM-DD

  // Goal progress
  goalProgress: text('goal_progress', { mode: 'json' }),

  // Sleep
  bedtime: text('bedtime'),
  wakeTime: text('wake_time'),
  sleepQuality: integer('sleep_quality'),
  sleepNote: text('sleep_note'),

  // Energy
  energyLevel: integer('energy_level'),
  energyNote: text('energy_note'),

  // Exercise
  exerciseDone: integer('exercise_done', { mode: 'boolean' }),
  exerciseType: text('exercise_type'),
  exerciseDuration: integer('exercise_duration'),
  exerciseNote: text('exercise_note'),

  // Diet
  dietEntries: text('diet_entries', { mode: 'json' }),
  dietQuality: integer('diet_quality'),
  dietNote: text('diet_note'),

  // Emotional
  mood: integer('mood'),
  emotionalState: text('emotional_state'),
  emotionalNote: text('emotional_note'),

  // Productivity
  focusHours: real('focus_hours'),
  tasksCompleted: integer('tasks_completed'),
  procrastination: integer('procrastination', { mode: 'boolean' }),
  biggestWin: text('biggest_win'),
  productivityNote: text('productivity_note'),

  // Relationships
  socialEvent: text('social_event'),
  relationshipsNote: text('relationships_note'),

  // Vices
  vicesDetails: text('vices_details'),
  vicesNote: text('vices_note'),

  // Meta
  overallScore: integer('overall_score'),
  dayRating: integer('day_rating'),

  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userDateIdx: index('daily_entries_user_date_idx').on(table.userId, table.date),
}));

export const goalLogs = sqliteTable('goal_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goal_id').notNull().references(() => goals.id),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  action: text('action'),
  valueChange: real('value_change'),
  note: text('note'),
  extractedFrom: integer('extracted_from'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userDateIdx: index('goal_logs_user_date_idx').on(table.userId, table.date),
}));

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  direction: text('direction').notNull(), // in, out
  contentType: text('content_type').notNull(), // text, audio, system
  rawContent: text('raw_content'),
  extractedData: text('extracted_data', { mode: 'json' }),
  tokens: integer('tokens'),
  timestamp: text('timestamp').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userTimestampIdx: index('messages_user_timestamp_idx').on(table.userId, table.timestamp),
}));

export const patterns = sqliteTable('patterns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  patternType: text('pattern_type').notNull(), // correlation, trend, anomaly
  areaA: text('area_a').notNull(),
  areaB: text('area_b').notNull(),
  description: text('description'),
  correlation: real('correlation'),
  dataPoints: integer('data_points'),
  confidence: real('confidence'),
  relatedGoalId: integer('related_goal_id').references(() => goals.id),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  reportType: text('report_type').notNull(), // weekly, monthly
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  content: text('content'),
  dataSnapshot: text('data_snapshot', { mode: 'json' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Onboarding State (persists in-progress onboarding, survives crashes) ──

export const onboardingState = sqliteTable('onboarding_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  step: integer('step').notNull().default(0),
  data: text('data', { mode: 'json' }), // serialized OnboardingState object
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userIdx: uniqueIndex('onboarding_state_user_idx').on(table.userId),
}));

// ── Sent Check-ins (prevents duplicate scheduled messages) ──

export const sentCheckins = sqliteTable('sent_checkins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  checkinType: text('checkin_type').notNull(), // morning, midday, afternoon, evening, weekly, monthly
  date: text('date').notNull(), // YYYY-MM-DD
  sentAt: text('sent_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueCheckin: uniqueIndex('sent_checkins_unique_idx').on(table.userId, table.checkinType, table.date),
}));

// ── Auth Tokens (for PWA magic link auth) ──

export const authTokens = sqliteTable('auth_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ── Habits ──

export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  emoji: text('emoji'),
  category: text('category'), // salud, espiritual, personal, educacion
  frequency: text('frequency').default('daily'), // daily, weekdays, custom
  isNegative: integer('is_negative', { mode: 'boolean' }).default(false), // true = success when NOT done (e.g. alcohol)
  targetMinutes: integer('target_minutes'), // for time-based habits (e.g. reading 30min)
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userIdx: index('habits_user_idx').on(table.userId),
}));

export const habitLogs = sqliteTable('habit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  completed: integer('completed', { mode: 'boolean' }).default(true),
  status: text('status').default('positive'),
  minutesLogged: integer('minutes_logged').default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueLog: uniqueIndex('habit_logs_unique_idx').on(table.habitId, table.date),
  userDateIdx: index('habit_logs_user_date_idx').on(table.userId, table.date),
}));

export const habitCompetitions = sqliteTable('habit_competitions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  createdByMode: text('created_by_mode').notNull().default('user'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const competitionParticipants = sqliteTable('competition_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competitionId: integer('competition_id').notNull().references(() => habitCompetitions.id),
  userId: integer('user_id').notNull().references(() => users.id),
  role: text('role').notNull().default('member'),
  inviteStatus: text('invite_status').notNull().default('pending'),
  joinedAt: text('joined_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueParticipant: uniqueIndex('competition_participants_unique_idx').on(table.competitionId, table.userId),
  competitionIdx: index('competition_participants_competition_idx').on(table.competitionId),
  userIdx: index('competition_participants_user_idx').on(table.userId),
}));

export const competitionHabits = sqliteTable('competition_habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competitionId: integer('competition_id').notNull().references(() => habitCompetitions.id),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  kind: text('kind').notNull().default('event'),
  scoringMode: text('scoring_mode').notNull().default('positive_only'),
  pointsPositive: integer('points_positive').notNull().default(1),
  pointsNegative: integer('points_negative').notNull().default(0),
  minutesPerBlock: integer('minutes_per_block'),
  pointsPerBlock: integer('points_per_block'),
  dailyTargetMinutes: integer('daily_target_minutes'),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  competitionIdx: index('competition_habits_competition_idx').on(table.competitionId),
}));

export const competitionHabitLinks = sqliteTable('competition_habit_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competitionHabitId: integer('competition_habit_id').notNull().references(() => competitionHabits.id),
  userId: integer('user_id').notNull().references(() => users.id),
  personalHabitId: integer('personal_habit_id').notNull().references(() => habits.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueLink: uniqueIndex('competition_habit_links_unique_idx').on(table.competitionHabitId, table.userId),
  habitIdx: index('competition_habit_links_habit_idx').on(table.competitionHabitId),
  userIdx: index('competition_habit_links_user_idx').on(table.userId),
}));

export const competitionHabitLogs = sqliteTable('competition_habit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  competitionHabitId: integer('competition_habit_id').notNull().references(() => competitionHabits.id),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  status: text('status').notNull().default('positive'),
  minutesLogged: integer('minutes_logged').default(0),
  pointsAwarded: integer('points_awarded').default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueLog: uniqueIndex('competition_habit_logs_unique_idx').on(table.competitionHabitId, table.userId, table.date),
  habitDateIdx: index('competition_habit_logs_habit_date_idx').on(table.competitionHabitId, table.date),
  userDateIdx: index('competition_habit_logs_user_date_idx').on(table.userId, table.date),
}));

// ── Study ──

export const studySessions = sqliteTable('study_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: text('date').notNull(),
  method: text('method').notNull(), // pomodoro, flow, flashcards, spaced_rep, five_three_one
  subject: text('subject'),
  focusMinutes: integer('focus_minutes').notNull(),
  breakMinutes: integer('break_minutes'),
  cyclesCompleted: integer('cycles_completed'),
  cardsReviewed: integer('cards_reviewed'),
  quality: integer('quality'), // 1-10
  note: text('note'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userDateIdx: index('study_sessions_user_date_idx').on(table.userId, table.date),
}));

export const flashcardDecks = sqliteTable('flashcard_decks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  emoji: text('emoji'),
  cardCount: integer('card_count').default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userIdx: index('flashcard_decks_user_idx').on(table.userId),
}));

export const flashcards = sqliteTable('flashcards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deckId: integer('deck_id').notNull().references(() => flashcardDecks.id),
  front: text('front').notNull(),
  back: text('back').notNull(),
  easeFactor: real('ease_factor').default(2.5), // SM-2 algorithm
  interval: integer('interval').default(0), // days until next review
  nextReview: text('next_review'), // YYYY-MM-DD
  repetitions: integer('repetitions').default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  deckIdx: index('flashcards_deck_idx').on(table.deckId),
  reviewIdx: index('flashcards_review_idx').on(table.nextReview),
}));

// ── Google Calendar OAuth Tokens ──

export const calendarTokens = sqliteTable('calendar_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiryDate: text('expiry_date'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userIdx: uniqueIndex('calendar_tokens_user_idx').on(table.userId),
}));

export const studySubjects = sqliteTable('study_subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  lastStudied: text('last_studied'),
  nextReview: text('next_review'), // YYYY-MM-DD
  reviewStage: integer('review_stage').default(0), // 0=new, 1=1d, 2=3d, 3=7d, 4=14d, 5=30d
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userIdx: index('study_subjects_user_idx').on(table.userId),
}));
