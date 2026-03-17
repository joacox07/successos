import { getDailyEntries, getGoalLogsByUser, getActiveGoals, upsertPattern } from '../db/repository.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

// Pearson correlation coefficient
function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

// Lag-1 correlation: does area A on day N correlate with area B on day N+1?
function laggedPearson(x: number[], y: number[]): number {
  if (x.length < 4) return 0;
  return pearson(x.slice(0, -1), y.slice(1));
}

type AreaExtractor = (entry: Record<string, unknown>) => number | null;

const supportAreas: Record<string, AreaExtractor> = {
  sleep: (e) => e.sleepQuality as number | null,
  energy: (e) => e.energyLevel as number | null,
  exercise: (e) => (e.exerciseDone ? 1 : 0),
  mood: (e) => e.mood as number | null,
  dietQuality: (e) => e.dietQuality as number | null,
  focusHours: (e) => e.focusHours as number | null,
  dayRating: (e) => e.dayRating as number | null,
};

function extractSeries(entries: Record<string, unknown>[], areaFn: AreaExtractor): (number | null)[] {
  return entries.map(areaFn);
}

function pairwiseValid(a: (number | null)[], b: (number | null)[]): [number[], number[]] {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== null && b[i] !== null) {
      x.push(a[i]!);
      y.push(b[i]!);
    }
  }
  return [x, y];
}

export async function analyzeCorrelations(userId: number): Promise<void> {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const entries = await getDailyEntries(userId, startDate, endDate);
  if (entries.length < config.minDataPointsForCorrelation) {
    logger.info({ userId, entries: entries.length }, 'Not enough data for correlations');
    return;
  }

  const goals = await getActiveGoals(userId);
  const goalLogs = await getGoalLogsByUser(userId, startDate, endDate);

  // Build daily goal progress series per goal
  const goalDailySeries = new Map<number, (number | null)[]>();
  for (const goal of goals) {
    const series: (number | null)[] = [];
    for (const entry of entries) {
      const dayLogs = goalLogs.filter(
        (l) => l.goalId === goal.id && l.date === entry.date,
      );
      const totalProgress = dayLogs.reduce((sum, l) => sum + (l.valueChange || 0), 0);
      series.push(totalProgress > 0 ? totalProgress : null);
    }
    goalDailySeries.set(goal.id, series);
  }

  const entriesAsRecords = entries as unknown as Record<string, unknown>[];

  // Correlate each support area with each goal
  for (const [areaName, areaFn] of Object.entries(supportAreas)) {
    const areaSeries = extractSeries(entriesAsRecords, areaFn);

    for (const goal of goals) {
      const goalSeries = goalDailySeries.get(goal.id);
      if (!goalSeries) continue;

      // Same-day correlation
      const [x, y] = pairwiseValid(areaSeries, goalSeries);
      if (x.length >= config.minDataPointsForCorrelation) {
        const r = pearson(x, y);
        if (Math.abs(r) >= config.correlationThreshold) {
          const direction = r > 0 ? 'mejora' : 'empeora';
          await upsertPattern({
            userId,
            patternType: 'correlation',
            areaA: areaName,
            areaB: `goal:${goal.id}`,
            description: `Cuando tu ${areaName} ${direction}, tu progreso en "${goal.title}" se ve afectado (r=${r.toFixed(2)})`,
            correlation: r,
            dataPoints: x.length,
            confidence: Math.min(x.length / 30, 1),
            relatedGoalId: goal.id,
          });
          logger.info({ userId, areaName, goalId: goal.id, r }, 'Correlation found');
        }
      }

      // Lag-1 correlation (yesterday's area → today's goal progress)
      const [xLag, yLag] = pairwiseValid(areaSeries.slice(0, -1), goalSeries.slice(1));
      if (xLag.length >= config.minDataPointsForCorrelation) {
        const rLag = pearson(xLag, yLag);
        if (Math.abs(rLag) >= config.correlationThreshold) {
          const direction = rLag > 0 ? 'bien' : 'mal';
          await upsertPattern({
            userId,
            patternType: 'correlation',
            areaA: `${areaName}:lag1`,
            areaB: `goal:${goal.id}`,
            description: `Cuando tu ${areaName} está ${direction}, al día siguiente tu progreso en "${goal.title}" cambia (r=${rLag.toFixed(2)})`,
            correlation: rLag,
            dataPoints: xLag.length,
            confidence: Math.min(xLag.length / 30, 1),
            relatedGoalId: goal.id,
          });
          logger.info({ userId, areaName, goalId: goal.id, rLag }, 'Lagged correlation found');
        }
      }
    }

    // Cross-area correlations
    for (const [otherArea, otherFn] of Object.entries(supportAreas)) {
      if (areaName >= otherArea) continue; // avoid duplicates
      const otherSeries = extractSeries(entriesAsRecords, otherFn);
      const [x2, y2] = pairwiseValid(areaSeries, otherSeries);
      if (x2.length >= config.minDataPointsForCorrelation) {
        const r = pearson(x2, y2);
        if (Math.abs(r) >= config.correlationThreshold) {
          await upsertPattern({
            userId,
            patternType: 'correlation',
            areaA: areaName,
            areaB: otherArea,
            description: `${areaName} y ${otherArea} están correlacionados (r=${r.toFixed(2)})`,
            correlation: r,
            dataPoints: x2.length,
            confidence: Math.min(x2.length / 30, 1),
          });
        }
      }
    }
  }
}
