import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { getSock } from '../whatsapp/connection.js';
import { sendText, sendTextChunked } from '../whatsapp/sender.js';
import {
  getAllOnboardedUsers,
  getActiveGoals,
  getTodayEntry,
  getActivePatterns,
  logMessage,
  hasCheckinBeenSent,
  markCheckinSent,
} from '../db/repository.js';
import {
  buildCheckInMorningPrompt,
  buildCheckInEveningPrompt,
} from '../ai/prompts.js';
import { generateCoachResponse } from '../ai/coach.js';
import { generateWeeklyReport } from '../engine/reports.js';
import { generateMonthlyReview } from '../engine/reports.js';
import { analyzeCorrelations } from '../engine/analytics.js';

function getTodayDate(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

function getCurrentHHMM(timezone: string): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function isFirstOfMonth(timezone: string): boolean {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: timezone }).split('-')[2];
  return day === '01';
}

function isSunday(timezone: string): boolean {
  const dow = new Date().toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
  return dow === 'Sun';
}

async function sendCheckinToUser(
  userId: number,
  phone: string,
  checkinType: string,
  date: string,
  message: string,
) {
  try {
    // Check if already sent today
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

    // Mark as sent to prevent duplicates
    await markCheckinSent(userId, checkinType, date);
  } catch (err) {
    logger.error({ err, userId, phone, checkinType }, 'Failed to send check-in');
  }
}

// Runs every 15 minutes — checks which users need a check-in
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

      // Smart midday prompt (14:00) — ask about goal progress if nothing reported
      if (isWithinWindow(now, '14:00')) {
        const entry = await getTodayEntry(user.id, date);
        const goals = await getActiveGoals(user.id);
        if (!entry || !entry.goalProgress) {
          const topGoal = goals.sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))[0];
          if (topGoal) {
            const message = `¿Cómo va el día? ¿Pudiste avanzar algo con "${topGoal.title}"?`;
            await sendCheckinToUser(user.id, user.phone, 'midday', date, message);
          }
        }
      }

      // Smart afternoon prompt (18:00) — ask about missing support areas
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

        // Generate AI-powered evening summary
        try {
          const response = await generateCoachResponse(
            'Resumen del día',
            (entry as Record<string, unknown>) || {},
            goalsForPrompt.map((g) => ({ ...g, category: '' })),
            [],
          );
          await sendCheckinToUser(user.id, user.phone, 'evening', date, response);
        } catch {
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

// Check if current time is within a 15-minute window of the target time
function isWithinWindow(current: string, target: string): boolean {
  const [ch, cm] = current.split(':').map(Number);
  const [th, tm] = target.split(':').map(Number);
  const currentMin = ch * 60 + cm;
  const targetMin = th * 60 + tm;
  return currentMin >= targetMin && currentMin < targetMin + 15;
}

export function startScheduler() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    logger.info('Running scheduled check-in loop');
    checkInLoop().catch((err) => logger.error({ err }, 'Check-in loop failed'));
  });

  logger.info('Scheduler started (every 15 min)');
}
