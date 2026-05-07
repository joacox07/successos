import { z } from 'zod';
import { getOpenAI } from './openai.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './prompts.js';

const GoalProgressSchema = z.object({
  goalId: z.number(),
  action: z.string().nullable().optional(),
  progress: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const NewHabitSchema = z.object({
  name: z.string(),
  category: z.string().nullable().optional(),
  frequency: z.enum(['daily', 'weekly']).optional().default('daily'),
  isNegative: z.boolean().optional().default(false),
});

const HabitCompletionSchema = z.object({
  habitName: z.string(),
  status: z.enum(['positive', 'negative']).default('positive'),
  durationMinutes: z.number().int().positive().nullable().optional(),
});

const ExtractionSchema = z.object({
  targetDate: z.string().nullable().optional(),
  goalProgress: z.preprocess(v => v ?? [], z.array(GoalProgressSchema)).optional().default([]),
  newHabits: z.preprocess(v => v ?? [], z.array(NewHabitSchema)).optional().default([]),
  habitCompletions: z.preprocess(v => v ?? [], z.array(HabitCompletionSchema)).optional().default([]),
  sleep: z.object({
    bedtime: z.string().nullable().optional(),
    wakeTime: z.string().nullable().optional(),
    quality: z.number().min(1).max(10).nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  energy: z.object({
    level: z.number().min(1).max(10).nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  exercise: z.object({
    done: z.boolean().nullable().optional(),
    type: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  diet: z.object({
    entries: z.array(z.string()).nullable().optional(),
    quality: z.number().min(1).max(10).nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  emotional: z.object({
    mood: z.number().min(1).max(10).nullable().optional(),
    state: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  productivity: z.object({
    focusHours: z.number().nullable().optional(),
    tasksCompleted: z.number().nullable().optional(),
    procrastination: z.boolean().nullable().optional(),
    biggestWin: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  relationships: z.object({
    socialEvent: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
  vices: z.object({
    details: z.array(z.string()).nullable().optional(),
    note: z.string().nullable().optional(),
  }).optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;
export type GoalProgress = z.infer<typeof GoalProgressSchema>;

export async function extractData(
  userText: string,
  goals: { id: number; title: string; category: string; metric: string | null; unit: string | null }[],
  todayData: Record<string, unknown> | null,
  existingHabits?: { id: number; name: string; category: string | null; isNegative?: boolean }[],
): Promise<ExtractionResult> {
  const openai = getOpenAI();

  const userPrompt = buildExtractionUserPrompt(userText, goals, todayData, existingHabits);

  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    'extraction',
  );

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    logger.warn('Empty extraction response');
    return { targetDate: null, goalProgress: [], newHabits: [], habitCompletions: [] };
  }

  try {
    const parsed = JSON.parse(rawContent);
    const result = ExtractionSchema.parse(parsed);
    logger.info({
      goalProgressCount: result.goalProgress.length,
      newHabits: result.newHabits.length,
      habitCompletions: result.habitCompletions.length,
    }, 'Data extracted');
    return result;
  } catch (err) {
    logger.error({ err, rawContent }, 'Extraction parse failed');
    return { targetDate: null, goalProgress: [], newHabits: [], habitCompletions: [] };
  }
}
