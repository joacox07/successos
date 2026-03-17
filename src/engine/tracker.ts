import { ExtractionResult, GoalProgress } from '../ai/extractor.js';
import {
  getTodayEntry,
  upsertDailyEntry,
  createGoalLog,
  updateGoal,
  getActiveGoals,
} from '../db/repository.js';
import { logger } from '../utils/logger.js';

function getTodayDate(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

// Merge logic: only overwrite null/undefined fields, append to arrays
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

export async function trackExtraction(
  userId: number,
  timezone: string,
  extraction: ExtractionResult,
  messageId?: number,
): Promise<void> {
  const date = getTodayDate(timezone);
  const existing = await getTodayEntry(userId, date);

  // Build the update object, only setting non-null extracted values
  const update: Record<string, unknown> = {};

  // Goal progress (merge with existing)
  if (extraction.goalProgress.length > 0) {
    const existingProgress = (existing?.goalProgress as GoalProgress[] | null) || [];
    update.goalProgress = mergeGoalProgress(existingProgress, extraction.goalProgress);
  }

  // Sleep
  if (extraction.sleep) {
    update.bedtime = mergeValue(existing?.bedtime, extraction.sleep.bedtime);
    update.wakeTime = mergeValue(existing?.wakeTime, extraction.sleep.wakeTime);
    update.sleepQuality = mergeValue(existing?.sleepQuality, extraction.sleep.quality);
    update.sleepNote = mergeValue(existing?.sleepNote, extraction.sleep.note);
  }

  // Energy
  if (extraction.energy) {
    update.energyLevel = mergeValue(existing?.energyLevel, extraction.energy.level);
    update.energyNote = mergeValue(existing?.energyNote, extraction.energy.note);
  }

  // Exercise
  if (extraction.exercise) {
    update.exerciseDone = mergeValue(existing?.exerciseDone, extraction.exercise.done);
    update.exerciseType = mergeValue(existing?.exerciseType, extraction.exercise.type);
    update.exerciseDuration = mergeValue(existing?.exerciseDuration, extraction.exercise.duration);
    update.exerciseNote = mergeValue(existing?.exerciseNote, extraction.exercise.note);
  }

  // Diet
  if (extraction.diet) {
    update.dietEntries = mergeValue(existing?.dietEntries, extraction.diet.entries);
    update.dietQuality = mergeValue(existing?.dietQuality, extraction.diet.quality);
    update.dietNote = mergeValue(existing?.dietNote, extraction.diet.note);
  }

  // Emotional
  if (extraction.emotional) {
    update.mood = mergeValue(existing?.mood, extraction.emotional.mood);
    update.emotionalState = mergeValue(existing?.emotionalState, extraction.emotional.state);
    update.emotionalNote = mergeValue(existing?.emotionalNote, extraction.emotional.note);
  }

  // Productivity
  if (extraction.productivity) {
    update.focusHours = mergeValue(existing?.focusHours, extraction.productivity.focusHours);
    update.tasksCompleted = mergeValue(existing?.tasksCompleted, extraction.productivity.tasksCompleted);
    update.procrastination = mergeValue(existing?.procrastination, extraction.productivity.procrastination);
    update.biggestWin = mergeValue(existing?.biggestWin, extraction.productivity.biggestWin);
    update.productivityNote = mergeValue(existing?.productivityNote, extraction.productivity.note);
  }

  // Relationships
  if (extraction.relationships) {
    update.socialEvent = mergeValue(existing?.socialEvent, extraction.relationships.socialEvent);
    update.relationshipsNote = mergeValue(existing?.relationshipsNote, extraction.relationships.note);
  }

  // Vices
  if (extraction.vices) {
    update.vicesDetails = mergeValue(existing?.vicesDetails, extraction.vices.details);
    update.vicesNote = mergeValue(existing?.vicesNote, extraction.vices.note);
  }

  // Upsert daily entry
  await upsertDailyEntry(userId, date, update);

  // Create goal logs and UPDATE currentValue for each goal progress
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

      // FIX: Actually update goal's currentValue with numeric progress
      if (gp.progress && gp.progress !== 0) {
        const userGoals = await getActiveGoals(userId);
        const goal = userGoals.find((g) => g.id === gp.goalId);
        if (goal) {
          const current = parseFloat(goal.currentValue || '0');
          const newValue = current + gp.progress;
          await updateGoal(gp.goalId, { currentValue: String(newValue) });
          logger.info({ goalId: gp.goalId, progress: gp.progress, newValue }, 'Goal currentValue updated');
        }
      }
    }
  }

  logger.info({ userId, date, fieldsUpdated: Object.keys(update).length }, 'Daily entry updated');
}
