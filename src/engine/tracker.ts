import { ExtractionResult, GoalProgress } from '../ai/extractor.js';
import {
  getTodayEntry,
  upsertDailyEntry,
  createGoalLog,
  updateGoal,
  getActiveGoals,
  getUserHabits,
  createHabit,
  setHabitLogStatus,
  addHabitLogMinutes,
} from '../db/repository.js';
import { syncCompetitionDurationFromPersonal } from '../db/competition.js';
import { logger } from '../utils/logger.js';
import { getTodayDate } from '../utils/dates.js';

function mergeValue<T>(existing: T | null | undefined, incoming: T | null | undefined): T | null | undefined {
  if (incoming === null || incoming === undefined) return existing;
  return incoming;
}

function mergeGoalProgress(
  existing: GoalProgress[] | null,
  incoming: GoalProgress[],
): GoalProgress[] {
  const merged = [...(existing || [])];
  for (const entry of incoming) {
    const idx = merged.findIndex((e) => e.goalId === entry.goalId);
    if (idx >= 0) {
      merged[idx] = {
        ...merged[idx],
        action: entry.action || merged[idx].action,
        progress: entry.progress ?? merged[idx].progress,
        unit: entry.unit || merged[idx].unit,
        note: entry.note || merged[idx].note,
      };
    } else {
      merged.push(entry);
    }
  }
  return merged;
}

function normalizeHabitName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findHabitMatch(
  existingHabits: Array<{ id: number; name: string; category: string | null; isNegative?: boolean | null; targetMinutes?: number | null }>,
  habitName: string,
) {
  const target = normalizeHabitName(habitName);
  if (!target) return null;

  const exact = existingHabits.filter((habit) => normalizeHabitName(habit.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const fuzzy = existingHabits.filter((habit) => {
    const current = normalizeHabitName(habit.name);
    return current.includes(target) || target.includes(current);
  });
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

async function logHabitMinutesWithCompetitionSync(
  habitId: number,
  userId: number,
  date: string,
  minutesDelta: number,
) {
  const result = await addHabitLogMinutes(habitId, userId, date, minutesDelta);
  syncCompetitionDurationFromPersonal({ personalHabitId: habitId, userId, date, minutesDelta });
  return result;
}

export async function trackExtraction(
  userId: number,
  timezone: string,
  extraction: ExtractionResult,
  messageId?: number,
): Promise<void> {
  const date = extraction.targetDate || getTodayDate(timezone);
  const existing = await getTodayEntry(userId, date);

  const update: Record<string, unknown> = {};

  if (extraction.goalProgress.length > 0) {
    const existingProgress = (existing?.goalProgress as GoalProgress[] | null) || [];
    update.goalProgress = mergeGoalProgress(existingProgress, extraction.goalProgress);
  }

  if (extraction.sleep) {
    update.bedtime = mergeValue(existing?.bedtime, extraction.sleep.bedtime);
    update.wakeTime = mergeValue(existing?.wakeTime, extraction.sleep.wakeTime);
    update.sleepQuality = mergeValue(existing?.sleepQuality, extraction.sleep.quality);
    update.sleepNote = mergeValue(existing?.sleepNote, extraction.sleep.note);
  }

  if (extraction.energy) {
    update.energyLevel = mergeValue(existing?.energyLevel, extraction.energy.level);
    update.energyNote = mergeValue(existing?.energyNote, extraction.energy.note);
  }

  if (extraction.exercise) {
    update.exerciseDone = mergeValue(existing?.exerciseDone, extraction.exercise.done);
    update.exerciseType = mergeValue(existing?.exerciseType, extraction.exercise.type);
    update.exerciseDuration = mergeValue(existing?.exerciseDuration, extraction.exercise.duration);
    update.exerciseNote = mergeValue(existing?.exerciseNote, extraction.exercise.note);
  }

  if (extraction.diet) {
    update.dietEntries = mergeValue(existing?.dietEntries, extraction.diet.entries);
    update.dietQuality = mergeValue(existing?.dietQuality, extraction.diet.quality);
    update.dietNote = mergeValue(existing?.dietNote, extraction.diet.note);
  }

  if (extraction.emotional) {
    update.mood = mergeValue(existing?.mood, extraction.emotional.mood);
    update.emotionalState = mergeValue(existing?.emotionalState, extraction.emotional.state);
    update.emotionalNote = mergeValue(existing?.emotionalNote, extraction.emotional.note);
  }

  if (extraction.productivity) {
    update.focusHours = mergeValue(existing?.focusHours, extraction.productivity.focusHours);
    update.tasksCompleted = mergeValue(existing?.tasksCompleted, extraction.productivity.tasksCompleted);
    update.procrastination = mergeValue(existing?.procrastination, extraction.productivity.procrastination);
    update.biggestWin = mergeValue(existing?.biggestWin, extraction.productivity.biggestWin);
    update.productivityNote = mergeValue(existing?.productivityNote, extraction.productivity.note);
  }

  if (extraction.relationships) {
    update.socialEvent = mergeValue(existing?.socialEvent, extraction.relationships.socialEvent);
    update.relationshipsNote = mergeValue(existing?.relationshipsNote, extraction.relationships.note);
  }

  if (extraction.vices) {
    update.vicesDetails = extraction.vices.details ? JSON.stringify(extraction.vices.details) : existing?.vicesDetails;
    update.vicesNote = mergeValue(existing?.vicesNote, extraction.vices.note);
  }

  await upsertDailyEntry(userId, date, update);

  const userGoals = extraction.goalProgress.length > 0 ? await getActiveGoals(userId) : [];

  for (const gp of extraction.goalProgress) {
    if (gp.action || gp.progress) {
      await createGoalLog({
        goalId: gp.goalId,
        userId,
        date,
        action: gp.action || null,
        valueChange: gp.progress ?? null,
        note: gp.note || null,
        extractedFrom: messageId ?? null,
      });

      if (gp.progress && gp.progress !== 0) {
        const goal = userGoals.find((item) => item.id === gp.goalId);
        if (goal) {
          const current = parseFloat(goal.currentValue || '0');
          const newValue = Math.max(0, current + gp.progress);
          await updateGoal(gp.goalId, { currentValue: String(newValue) });
          logger.info({ goalId: gp.goalId, progress: gp.progress, newValue }, 'Goal currentValue updated');
        }
      }
    }
  }

  let currentHabits = extraction.newHabits.length > 0 || extraction.habitCompletions.length > 0
    ? await getUserHabits(userId)
    : [];

  if (extraction.newHabits && extraction.newHabits.length > 0) {
    for (const newHabit of extraction.newHabits) {
      const alreadyExists = !!findHabitMatch(currentHabits, newHabit.name);
      if (alreadyExists) continue;

      const matchingCompletion = extraction.habitCompletions.find(
        (completion) => normalizeHabitName(completion.habitName) === normalizeHabitName(newHabit.name),
      );

      try {
        const habit = await createHabit({
          userId,
          name: newHabit.name,
          category: newHabit.category || 'general',
          frequency: newHabit.frequency || 'daily',
          isNegative: !!newHabit.isNegative,
        });
        currentHabits = [...currentHabits, habit];
        if (matchingCompletion?.durationMinutes && !newHabit.isNegative) {
          await logHabitMinutesWithCompetitionSync(habit.id, userId, date, matchingCompletion.durationMinutes);
        } else {
          await setHabitLogStatus(habit.id, userId, date, matchingCompletion?.status ?? 'positive');
        }
        logger.info({ userId, habitId: habit.id, name: newHabit.name }, 'Auto-created new habit from AI extraction');
      } catch (err) {
        logger.error({ err, habitName: newHabit.name }, 'Failed to auto-create habit');
      }
    }
  }

  if (extraction.habitCompletions && extraction.habitCompletions.length > 0) {
    for (const completion of extraction.habitCompletions) {
      const matchedHabit = findHabitMatch(currentHabits, completion.habitName);
      if (!matchedHabit) {
        logger.warn({ userId, habitName: completion.habitName }, 'Habit completion skipped due to ambiguous or missing match');
        continue;
      }

      try {
        if (completion.durationMinutes && !matchedHabit.isNegative) {
          await logHabitMinutesWithCompetitionSync(matchedHabit.id, userId, date, completion.durationMinutes);
          logger.info({
            userId,
            habitId: matchedHabit.id,
            name: matchedHabit.name,
            durationMinutes: completion.durationMinutes,
          }, 'Auto-added habit minutes from AI extraction');
        } else {
          await setHabitLogStatus(matchedHabit.id, userId, date, completion.status);
          logger.info({ userId, habitId: matchedHabit.id, name: matchedHabit.name, status: completion.status }, 'Auto-set habit status from AI extraction');
        }
      } catch (err) {
        logger.error({ err, habitName: completion.habitName, status: completion.status }, 'Failed to set habit status');
      }
    }
  }

  logger.info({ userId, date, fieldsUpdated: Object.keys(update).length }, 'Daily entry updated');
}
