import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { getDb } from './client.js';
import { users, profiles, goals, dailyEntries, goalLogs, messages, patterns, reports, onboardingState, sentCheckins, authTokens, habits, habitLogs, studySessions, flashcardDecks, flashcards, studySubjects } from './schema.js';

// ── Users ──

export async function findUserByPhone(phone: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return user ?? null;
}

export async function createUser(phone: string) {
  const db = getDb();
  const [user] = await db.insert(users).values({ phone }).returning();
  return user;
}

export async function updateUser(userId: number, data: Partial<typeof users.$inferInsert>) {
  const db = getDb();
  await db.update(users).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
}

export async function getAllOnboardedUsers() {
  const db = getDb();
  return db.select().from(users).where(eq(users.onboardingComplete, true));
}

// ── Profiles ──

export async function upsertProfile(userId: number, data: Partial<typeof profiles.$inferInsert>) {
  const db = getDb();
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (existing) {
    await db.update(profiles).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(profiles.id, existing.id));
    return { ...existing, ...data };
  }
  const [profile] = await db.insert(profiles).values({ userId, ...data }).returning();
  return profile;
}

export async function getProfile(userId: number) {
  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return profile ?? null;
}

// ── Goals ──

export async function createGoal(data: typeof goals.$inferInsert) {
  const db = getDb();
  const [goal] = await db.insert(goals).values(data).returning();
  return goal;
}

export async function getActiveGoals(userId: number) {
  const db = getDb();
  return db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.status, 'active')));
}

export async function getAllGoals(userId: number) {
  const db = getDb();
  return db.select().from(goals).where(eq(goals.userId, userId));
}

export async function updateGoal(goalId: number, data: Partial<typeof goals.$inferInsert>) {
  const db = getDb();
  await db.update(goals).set(data).where(eq(goals.id, goalId));
}

// ── Daily Entries ──

export async function getTodayEntry(userId: number, date: string) {
  const db = getDb();
  const [entry] = await db.select().from(dailyEntries)
    .where(and(eq(dailyEntries.userId, userId), eq(dailyEntries.date, date)))
    .limit(1);
  return entry ?? null;
}

export async function upsertDailyEntry(userId: number, date: string, data: Partial<typeof dailyEntries.$inferInsert>) {
  const db = getDb();
  const existing = await getTodayEntry(userId, date);
  if (existing) {
    await db.update(dailyEntries)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(dailyEntries.id, existing.id));
    return { ...existing, ...data };
  }
  const [entry] = await db.insert(dailyEntries).values({ userId, date, ...data }).returning();
  return entry;
}

export async function getDailyEntries(userId: number, startDate: string, endDate: string) {
  const db = getDb();
  return db.select().from(dailyEntries)
    .where(and(
      eq(dailyEntries.userId, userId),
      gte(dailyEntries.date, startDate),
      lte(dailyEntries.date, endDate),
    ))
    .orderBy(dailyEntries.date);
}

// ── Goal Logs ──

export async function createGoalLog(data: typeof goalLogs.$inferInsert) {
  const db = getDb();
  const [log] = await db.insert(goalLogs).values(data).returning();
  return log;
}

export async function getGoalLogs(goalId: number, startDate: string, endDate: string) {
  const db = getDb();
  return db.select().from(goalLogs)
    .where(and(
      eq(goalLogs.goalId, goalId),
      gte(goalLogs.date, startDate),
      lte(goalLogs.date, endDate),
    ))
    .orderBy(goalLogs.date);
}

export async function getGoalLogsByUser(userId: number, startDate: string, endDate: string) {
  const db = getDb();
  return db.select().from(goalLogs)
    .where(and(
      eq(goalLogs.userId, userId),
      gte(goalLogs.date, startDate),
      lte(goalLogs.date, endDate),
    ))
    .orderBy(goalLogs.date);
}

// ── Messages ──

export async function logMessage(data: typeof messages.$inferInsert) {
  const db = getDb();
  const [msg] = await db.insert(messages).values(data).returning();
  return msg;
}

export async function getRecentMessages(userId: number, limit = 10) {
  const db = getDb();
  return db.select().from(messages)
    .where(eq(messages.userId, userId))
    .orderBy(desc(messages.timestamp))
    .limit(limit);
}

// ── Patterns ──

export async function upsertPattern(data: typeof patterns.$inferInsert) {
  const db = getDb();
  const [existing] = await db.select().from(patterns)
    .where(and(
      eq(patterns.userId, data.userId),
      eq(patterns.areaA, data.areaA),
      eq(patterns.areaB, data.areaB),
    ))
    .limit(1);
  if (existing) {
    await db.update(patterns)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(patterns.id, existing.id));
    return { ...existing, ...data };
  }
  const [pattern] = await db.insert(patterns).values(data).returning();
  return pattern;
}

export async function getActivePatterns(userId: number) {
  const db = getDb();
  return db.select().from(patterns)
    .where(and(eq(patterns.userId, userId), eq(patterns.active, true)));
}

// ── Reports ──

export async function createReport(data: typeof reports.$inferInsert) {
  const db = getDb();
  const [report] = await db.insert(reports).values(data).returning();
  return report;
}

export async function getLatestReport(userId: number, reportType: string) {
  const db = getDb();
  const [report] = await db.select().from(reports)
    .where(and(eq(reports.userId, userId), eq(reports.reportType, reportType)))
    .orderBy(desc(reports.createdAt))
    .limit(1);
  return report ?? null;
}

// ── Onboarding State ──

export async function getOnboardingState(userId: number) {
  const db = getDb();
  const [state] = await db.select().from(onboardingState)
    .where(eq(onboardingState.userId, userId))
    .limit(1);
  return state ?? null;
}

export async function upsertOnboardingState(userId: number, step: number, data: unknown) {
  const db = getDb();
  const existing = await getOnboardingState(userId);
  if (existing) {
    await db.update(onboardingState)
      .set({ step, data: data as any, updatedAt: new Date().toISOString() })
      .where(eq(onboardingState.userId, userId));
  } else {
    await db.insert(onboardingState).values({ userId, step, data: data as any });
  }
}

export async function deleteOnboardingState(userId: number) {
  const db = getDb();
  await db.delete(onboardingState).where(eq(onboardingState.userId, userId));
}

// ── Sent Check-ins ──

export async function hasCheckinBeenSent(userId: number, checkinType: string, date: string): Promise<boolean> {
  const db = getDb();
  const [existing] = await db.select().from(sentCheckins)
    .where(and(
      eq(sentCheckins.userId, userId),
      eq(sentCheckins.checkinType, checkinType),
      eq(sentCheckins.date, date),
    ))
    .limit(1);
  return !!existing;
}

export async function markCheckinSent(userId: number, checkinType: string, date: string) {
  const db = getDb();
  await db.insert(sentCheckins).values({ userId, checkinType, date }).onConflictDoNothing();
}

// ── Recent Messages (chronological order for context) ──

export async function getRecentMessagesAsc(userId: number, limit = 10) {
  const db = getDb();
  // Get last N messages then reverse to chronological
  const msgs = await db.select().from(messages)
    .where(eq(messages.userId, userId))
    .orderBy(desc(messages.timestamp))
    .limit(limit);
  return msgs.reverse();
}

// ── Auth Tokens ──

export async function createAuthToken(userId: number, token: string, expiresAt: string) {
  const db = getDb();
  await db.insert(authTokens).values({ userId, token, expiresAt });
}

export async function validateAuthToken(token: string) {
  const db = getDb();
  const [t] = await db.select().from(authTokens)
    .where(and(eq(authTokens.token, token), eq(authTokens.used, false)))
    .limit(1);
  if (!t) return null;
  if (new Date(t.expiresAt) < new Date()) return null;
  // Mark as used
  await db.update(authTokens).set({ used: true }).where(eq(authTokens.id, t.id));
  return t;
}

// ── Habits ──

export async function createHabit(data: typeof habits.$inferInsert) {
  const db = getDb();
  const [habit] = await db.insert(habits).values(data).returning();
  return habit;
}

export async function getUserHabits(userId: number) {
  const db = getDb();
  return db.select().from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.active, true)));
}

export async function updateHabit(habitId: number, data: Partial<typeof habits.$inferInsert>) {
  const db = getDb();
  await db.update(habits)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(habits.id, habitId));
}

export async function deactivateHabit(habitId: number) {
  const db = getDb();
  await db.update(habits)
    .set({ active: false, updatedAt: new Date().toISOString() })
    .where(eq(habits.id, habitId));
}

export async function toggleHabitLog(habitId: number, userId: number, date: string) {
  const db = getDb();
  const [existing] = await db.select().from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)))
    .limit(1);
  if (existing) {
    await db.delete(habitLogs).where(eq(habitLogs.id, existing.id));
    return false; // unchecked
  }
  await db.insert(habitLogs).values({ habitId, userId, date });
  return true; // checked
}

export async function getHabitLogs(habitId: number, startDate: string, endDate: string) {
  const db = getDb();
  return db.select().from(habitLogs)
    .where(and(
      eq(habitLogs.habitId, habitId),
      gte(habitLogs.date, startDate),
      lte(habitLogs.date, endDate),
    ));
}

export async function getHabitsToday(userId: number, date: string) {
  const db = getDb();
  const userHabits = await getUserHabits(userId);
  const logs = await db.select().from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.date, date)));
  const completedIds = new Set(logs.map(l => l.habitId));
  return { habits: userHabits, today: Object.fromEntries(userHabits.map(h => [h.id, completedIds.has(h.id)])) };
}

// ── Study Sessions ──

export async function createStudySession(data: typeof studySessions.$inferInsert) {
  const db = getDb();
  const [session] = await db.insert(studySessions).values(data).returning();
  return session;
}

export async function getStudySessions(userId: number, startDate: string, endDate: string) {
  const db = getDb();
  return db.select().from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      gte(studySessions.date, startDate),
      lte(studySessions.date, endDate),
    ))
    .orderBy(desc(studySessions.startedAt));
}

export async function getStudyStats(userId: number, startDate: string, endDate: string) {
  const db = getDb();
  const sessions = await getStudySessions(userId, startDate, endDate);
  const totalFocusMinutes = sessions.reduce((sum, s) => sum + s.focusMinutes, 0);
  const qualities = sessions.filter(s => s.quality != null).map(s => s.quality!);
  const avgQuality = qualities.length > 0 ? qualities.reduce((a, b) => a + b, 0) / qualities.length : null;

  // Daily minutes for chart
  const dailyMap = new Map<string, number>();
  for (const s of sessions) {
    dailyMap.set(s.date, (dailyMap.get(s.date) || 0) + s.focusMinutes);
  }
  const dailyMinutes = Array.from(dailyMap.entries())
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Streak: consecutive days with sessions
  const datesWithSessions = new Set(sessions.map(s => s.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (datesWithSessions.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return { totalFocusMinutes, sessionsCount: sessions.length, avgQuality, streak, dailyMinutes };
}

// ── Flashcard Decks ──

export async function createFlashcardDeck(data: typeof flashcardDecks.$inferInsert) {
  const db = getDb();
  const [deck] = await db.insert(flashcardDecks).values(data).returning();
  return deck;
}

export async function getUserDecks(userId: number) {
  const db = getDb();
  return db.select().from(flashcardDecks).where(eq(flashcardDecks.userId, userId));
}

export async function updateDeckCardCount(deckId: number) {
  const db = getDb();
  const cards = await db.select().from(flashcards).where(eq(flashcards.deckId, deckId));
  await db.update(flashcardDecks)
    .set({ cardCount: cards.length, updatedAt: new Date().toISOString() })
    .where(eq(flashcardDecks.id, deckId));
}

export async function deleteFlashcardDeck(deckId: number) {
  const db = getDb();
  await db.delete(flashcards).where(eq(flashcards.deckId, deckId));
  await db.delete(flashcardDecks).where(eq(flashcardDecks.id, deckId));
}

// ── Flashcards ──

export async function createFlashcard(data: typeof flashcards.$inferInsert) {
  const db = getDb();
  const [card] = await db.insert(flashcards).values(data).returning();
  await updateDeckCardCount(data.deckId);
  return card;
}

export async function getDeckCards(deckId: number) {
  const db = getDb();
  return db.select().from(flashcards).where(eq(flashcards.deckId, deckId));
}

export async function getCardsForReview(deckId: number, today: string) {
  const db = getDb();
  return db.select().from(flashcards)
    .where(and(
      eq(flashcards.deckId, deckId),
      lte(flashcards.nextReview, today),
    ));
}

export async function updateFlashcard(cardId: number, data: Partial<typeof flashcards.$inferInsert>) {
  const db = getDb();
  await db.update(flashcards).set(data).where(eq(flashcards.id, cardId));
}

export async function deleteFlashcard(cardId: number) {
  const db = getDb();
  const [card] = await db.select().from(flashcards).where(eq(flashcards.id, cardId)).limit(1);
  await db.delete(flashcards).where(eq(flashcards.id, cardId));
  if (card) await updateDeckCardCount(card.deckId);
}

// ── Study Subjects (Spaced Repetition) ──

export async function createStudySubject(data: typeof studySubjects.$inferInsert) {
  const db = getDb();
  const [subject] = await db.insert(studySubjects).values(data).returning();
  return subject;
}

export async function getUserSubjects(userId: number) {
  const db = getDb();
  return db.select().from(studySubjects).where(eq(studySubjects.userId, userId));
}

const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

export async function markSubjectStudied(subjectId: number) {
  const db = getDb();
  const [subject] = await db.select().from(studySubjects).where(eq(studySubjects.id, subjectId)).limit(1);
  if (!subject) return null;
  const newStage = Math.min(subject.reviewStage + 1, REVIEW_INTERVALS.length - 1);
  const daysUntilNext = REVIEW_INTERVALS[newStage] || 30;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysUntilNext);
  await db.update(studySubjects).set({
    lastStudied: new Date().toISOString().split('T')[0],
    nextReview: nextDate.toISOString().split('T')[0],
    reviewStage: newStage,
  }).where(eq(studySubjects.id, subjectId));
  return { ...subject, reviewStage: newStage, nextReview: nextDate.toISOString().split('T')[0] };
}

export async function deleteStudySubject(subjectId: number) {
  const db = getDb();
  await db.delete(studySubjects).where(eq(studySubjects.id, subjectId));
}
