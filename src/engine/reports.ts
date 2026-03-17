import { getOpenAI } from '../ai/openai.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { WEEKLY_REPORT_PROMPT, MONTHLY_REVIEW_PROMPT } from '../ai/prompts.js';
import {
  getDailyEntries,
  getActiveGoals,
  getGoalLogsByUser,
  getActivePatterns,
  createReport,
  getLatestReport,
} from '../db/repository.js';

function getDateRange(type: 'weekly' | 'monthly', timezone = 'America/Argentina/Buenos_Aires'): { start: string; end: string } {
  const end = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  const [y, m, d] = end.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);
  if (type === 'weekly') {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }
  const start = startDate.toLocaleDateString('en-CA');
  return { start, end };
}

export async function generateWeeklyReport(userId: number): Promise<string> {
  const { start, end } = getDateRange('weekly');

  const [entries, goals, goalLogs, patterns] = await Promise.all([
    getDailyEntries(userId, start, end),
    getActiveGoals(userId),
    getGoalLogsByUser(userId, start, end),
    getActivePatterns(userId),
  ]);

  if (entries.length === 0) {
    return 'No tengo suficientes datos de esta semana para hacer un reporte. ¡Mandame más updates!';
  }

  // Build data summary for AI
  const goalSummaries = goals.map((g) => {
    const logs = goalLogs.filter((l) => l.goalId === g.id);
    const totalProgress = logs.reduce((sum, l) => sum + (l.valueChange || 0), 0);
    return {
      title: g.title,
      category: g.category,
      current: g.currentValue,
      target: g.targetValue,
      unit: g.unit,
      weekProgress: totalProgress,
      actions: logs.map((l) => l.action).filter(Boolean),
    };
  });

  const avgMetrics = {
    avgSleep: avg(entries.map((e) => e.sleepQuality)),
    avgMood: avg(entries.map((e) => e.mood)),
    avgEnergy: avg(entries.map((e) => e.energyLevel)),
    exerciseDays: entries.filter((e) => e.exerciseDone).length,
    totalDays: entries.length,
    avgDayRating: avg(entries.map((e) => e.dayRating)),
  };

  const patternDescriptions = patterns.map((p) => p.description).filter(Boolean);

  // Get previous week's report for comparison
  const prevReport = await getLatestReport(userId, 'weekly');
  const prevSnapshot = prevReport?.dataSnapshot as Record<string, unknown> | null;

  const openai = getOpenAI();
  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          { role: 'system', content: WEEKLY_REPORT_PROMPT },
          {
            role: 'user',
            content: `DATOS DE LA SEMANA (${start} a ${end}):

OBJETIVOS:
${JSON.stringify(goalSummaries, null, 2)}

MÉTRICAS PROMEDIO:
${JSON.stringify(avgMetrics, null, 2)}

PATRONES DETECTADOS:
${patternDescriptions.join('\n')}

REPORTE SEMANA ANTERIOR:
${prevSnapshot ? JSON.stringify(prevSnapshot, null, 2) : 'No hay reporte anterior'}

Generá el reporte semanal.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    'weekly-report',
  );

  const content = response.choices[0]?.message?.content || 'No se pudo generar el reporte.';

  // Save report
  await createReport({
    userId,
    reportType: 'weekly',
    periodStart: start,
    periodEnd: end,
    content,
    dataSnapshot: { goalSummaries, avgMetrics, patternDescriptions },
  });

  logger.info({ userId, start, end }, 'Weekly report generated');
  return content;
}

export async function generateMonthlyReview(userId: number): Promise<string> {
  const { start, end } = getDateRange('monthly');

  const [entries, goals, goalLogs, patterns] = await Promise.all([
    getDailyEntries(userId, start, end),
    getActiveGoals(userId),
    getGoalLogsByUser(userId, start, end),
    getActivePatterns(userId),
  ]);

  const goalSummaries = goals.map((g) => {
    const logs = goalLogs.filter((l) => l.goalId === g.id);
    const totalProgress = logs.reduce((sum, l) => sum + (l.valueChange || 0), 0);
    return {
      title: g.title,
      current: g.currentValue,
      target: g.targetValue,
      unit: g.unit,
      monthProgress: totalProgress,
      status: g.status,
    };
  });

  const openai = getOpenAI();
  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          { role: 'system', content: MONTHLY_REVIEW_PROMPT },
          {
            role: 'user',
            content: `DATOS DEL MES (${start} a ${end}):

OBJETIVOS:
${JSON.stringify(goalSummaries, null, 2)}

TOTAL DÍAS CON DATOS: ${entries.length}

PATRONES:
${patterns.map((p) => p.description).filter(Boolean).join('\n')}

Generá la revisión mensual.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    'monthly-review',
  );

  const content = response.choices[0]?.message?.content || 'No se pudo generar la revisión mensual.';

  await createReport({
    userId,
    reportType: 'monthly',
    periodStart: start,
    periodEnd: end,
    content,
  });

  logger.info({ userId, start, end }, 'Monthly review generated');
  return content;
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}
