import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { getTodayDate, getCurrentHHMM, isWithinWindow, isSunday, isFirstOfMonth } from '../utils/dates.js';
import { getSock } from '../whatsapp/connection.js';
import { sendText, sendTextChunked } from '../whatsapp/sender.js';
import {
  getAllOnboardedUsers,
  getActiveGoals,
  getTodayEntry,
  logMessage,
  hasCheckinBeenSent,
  markCheckinSent,
} from '../db/repository.js';
import {
  buildCheckInMorningPrompt,
  buildCheckInEveningPrompt,
} from '../ai/prompts.js';
import { generateCoachResponse } from '../ai/coach.js';
import { generateWeeklyReport, generateMonthlyReview } from '../engine/reports.js';
import { analyzeCorrelations } from '../engine/analytics.js';

async function sendCheckinToUser(
  userId: number,
  phone: string,
  checkinType: string,
  date: string,
  message: string,
) {
  try {
    const alreadySent = await hasCheckinBeenSent(userId, checkinType, date);
    if (alreadySent) {
      logger.debug({ userId, checkinType, date }, 'Check-in already sent, skipping');
      return;
    }

    const sock = getSock();
    await sendText(sock, phone, message);
    await logMessage({
      userId,
      direction: 'out',
      contentType: 'system',
      rawContent: message,
    });

    await markCheckinSent(userId, checkinType, date);
  } catch (err) {
    logger.error({ err, userId, phone, checkinType }, 'Failed to send check-in');
  }
}

async function checkInLoop() {
  let users;
  try {
    users = await getAllOnboardedUsers();
  } catch (err) {
    logger.error({ err }, 'Failed to get users for check-in');
    return;
  }

  for (const user of users) {
    const tz = user.timezone || 'America/Argentina/Buenos_Aires';
    const now = getCurrentHHMM(tz);
    const date = getTodayDate(tz);

    try {
      // Morning check-in
      const morningTime = user.morningCheckIn || '07:00';
      if (isWithinWindow(now, morningTime)) {
        const goals = await getActiveGoals(user.id);
        const goalsForPrompt = goals.map((g) => ({ title: g.title, priority: g.priority ?? 3 }));
        const message = buildCheckInMorningPrompt(user.name || '', goalsForPrompt);
        await sendCheckinToUser(user.id, user.phone, 'morning', date, message);
      }

      // Smart midday prompt (14:00)
      if (isWithinWindow(now, '14:00')) {
        const entry = await getTodayEntry(user.id, date);
        const goals = await getActiveGoals(user.id);
        if (!entry || !entry.goalProgress) {
          const sorted = [...goals].sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));
          const topPriority = sorted[0]?.priority ?? 3;
          const topGoals = sorted.filter((g) => (g.priority ?? 3) === topPriority);
          const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
          const todayGoal = topGoals[dayOfYear % topGoals.length];
          if (todayGoal) {
            const message = `¿Cómo va el día? ¿Pudiste avanzar algo con "${todayGoal.title}"?`;
            await sendCheckinToUser(user.id, user.phone, 'midday', date, message);
          }
        }
      }

      // Smart afternoon prompt (18:00)
      if (isWithinWindow(now, '18:00')) {
        const entry = await getTodayEntry(user.id, date);
        if (entry) {
          const missing: string[] = [];
          if (entry.exerciseDone === null) missing.push('ejercicio');
          if (entry.mood === null) missing.push('cómo te sentís');
          if (entry.energyLevel === null) missing.push('tu nivel de energía');
          if (missing.length > 0 && missing.length <= 3) {
            const message = `Che, antes de que cierre el día: ¿me contás algo sobre ${missing.join(' y ')}?`;
            await sendCheckinToUser(user.id, user.phone, 'afternoon', date, message);
          }
        }
      }

      // Evening check-in
      const eveningTime = user.eveningCheckIn || '22:00';
      if (isWithinWindow(now, eveningTime)) {
        const goals = await getActiveGoals(user.id);
        const entry = await getTodayEntry(user.id, date);
        const goalsForPrompt = goals.map((g) => ({
          id: g.id,
          title: g.title,
          currentValue: g.currentValue,
          targetValue: g.targetValue,
          unit: g.unit,
        }));

        try {
          const response = await generateCoachResponse(
            'Resumen del día',
            (entry as Record<string, unknown>) || {},
            goalsForPrompt.map((g) => ({ ...g, category: '' })),
            [],
          );
          await sendCheckinToUser(user.id, user.phone, 'evening', date, response);
        } catch (err) {
          logger.warn({ err, userId: user.id }, 'Evening AI coach failed, using fallback');
          const fallback = buildCheckInEveningPrompt(user.name || '', goalsForPrompt, entry as Record<string, unknown> | null);
          await sendCheckinToUser(user.id, user.phone, 'evening', date, fallback);
        }
      }

      // Weekly report — Sunday 20:00
      if (isSunday(tz) && isWithinWindow(now, '20:00')) {
        const alreadySent = await hasCheckinBeenSent(user.id, 'weekly', date);
        if (!alreadySent) {
          await analyzeCorrelations(user.id);
          const report = await generateWeeklyReport(user.id);
          const sock = getSock();
          await sendTextChunked(sock, user.phone, report);
          await logMessage({
            userId: user.id,
            direction: 'out',
            contentType: 'system',
            rawContent: report,
          });
          await markCheckinSent(user.id, 'weekly', date);
        }
      }

      // Monthly review — 1st of month at 20:00
      if (isFirstOfMonth(tz) && isWithinWindow(now, '20:00')) {
        const alreadySent = await hasCheckinBeenSent(user.id, 'monthly', date);
        if (!alreadySent) {
          const review = await generateMonthlyReview(user.id);
          const sock = getSock();
          await sendTextChunked(sock, user.phone, review);
          await logMessage({
            userId: user.id,
            direction: 'out',
            contentType: 'system',
            rawContent: review,
          });
          await markCheckinSent(user.id, 'monthly', date);
        }
      }
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Error in check-in loop for user');
    }
  }
}

export function startScheduler() {
  cron.schedule('*/15 * * * *', () => {
    logger.info('Running scheduled check-in loop');
    checkInLoop().catch((err) => logger.error({ err }, 'Check-in loop failed'));
  });

  cron.schedule('0 3 * * *', async () => {
    logger.info('Running daily analytics for all users...');
    try {
      const users = await getAllOnboardedUsers();
      for (const user of users) {
        try {
          await analyzeCorrelations(user.id);
          logger.info({ userId: user.id }, 'Daily analytics complete');
        } catch (err) {
          logger.error({ err, userId: user.id }, 'Daily analytics failed for user');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Daily analytics loop failed');
    }
  });

  logger.info('Scheduler started (check-ins every 15 min, analytics daily at 3am)');
}
