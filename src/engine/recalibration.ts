import { getOpenAI } from '../ai/openai.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import {
  getActiveGoals,
  getAllGoals,
  updateGoal,
  createGoal,
} from '../db/repository.js';
import { z } from 'zod';

const RecalibrationActionSchema = z.object({
  actions: z.array(z.object({
    type: z.enum(['update', 'pause', 'complete', 'add']),
    goalId: z.number().nullable().optional(),
    title: z.string().optional(),
    category: z.string().optional(),
    metric: z.string().optional(),
    targetValue: z.string().optional(),
    unit: z.string().optional(),
    deadline: z.string().nullable().optional(),
    newTargetValue: z.string().optional(),
    reason: z.string().optional(),
  })),
});

export async function processRecalibration(
  userId: number,
  userText: string,
): Promise<string> {
  const goals = await getAllGoals(userId);

  const goalsDesc = goals.map((g) =>
    `[ID:${g.id}] "${g.title}" (${g.status}) — actual: ${g.currentValue}/${g.targetValue} ${g.unit || ''}`
  ).join('\n');

  const openai = getOpenAI();

  // First: extract what the user wants to change
  const extractionResponse = await withRetry(
    () =>
      openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          {
            role: 'system',
            content: `Sos un sistema de recalibración de objetivos. El usuario quiere ajustar sus objetivos después de una revisión mensual.

Analizá lo que el usuario dice y generá las acciones correspondientes.

Tipos de acciones:
- "update": cambiar targetValue o deadline de un objetivo existente (incluí goalId y newTargetValue)
- "pause": pausar un objetivo (incluí goalId)
- "complete": marcar objetivo como completado (incluí goalId)
- "add": agregar nuevo objetivo (incluí title, category, metric, targetValue, unit, deadline)

Respondé SOLO con JSON: { "actions": [...] }
Si el usuario no quiere cambiar nada, respondé { "actions": [] }`,
          },
          {
            role: 'user',
            content: `OBJETIVOS ACTUALES:\n${goalsDesc}\n\nMENSAJE DEL USUARIO:\n"${userText}"`,
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    'recalibration-extraction',
  );

  const rawContent = extractionResponse.choices[0]?.message?.content || '{"actions":[]}';
  let parsed;
  try {
    parsed = RecalibrationActionSchema.parse(JSON.parse(rawContent));
  } catch (err) {
    logger.error({ err, rawContent }, 'Failed to parse recalibration actions');
    return 'No pude entender los cambios. ¿Me lo decís de otra manera? Por ejemplo: "subí la meta de ventas a $15K" o "pausá el objetivo de lectura"';
  }

  if (parsed.actions.length === 0) {
    return 'Perfecto, seguimos con los mismos objetivos. ¡A darle este mes! 💪';
  }

  // Apply actions
  const results: string[] = [];

  for (const action of parsed.actions) {
    try {
      switch (action.type) {
        case 'update': {
          if (action.goalId) {
            const updates: Record<string, unknown> = {};
            if (action.newTargetValue) updates.targetValue = action.newTargetValue;
            if (action.deadline) updates.deadline = action.deadline;
            await updateGoal(action.goalId, updates);
            const goal = goals.find((g) => g.id === action.goalId);
            results.push(`Actualizado "${goal?.title || 'objetivo'}" → nueva meta: ${action.newTargetValue || 'sin cambios'}`);
          }
          break;
        }
        case 'pause': {
          if (action.goalId) {
            await updateGoal(action.goalId, { status: 'paused' });
            const goal = goals.find((g) => g.id === action.goalId);
            results.push(`Pausado "${goal?.title || 'objetivo'}"`);
          }
          break;
        }
        case 'complete': {
          if (action.goalId) {
            await updateGoal(action.goalId, { status: 'completed' });
            const goal = goals.find((g) => g.id === action.goalId);
            results.push(`Completado "${goal?.title || 'objetivo'}" 🎉`);
          }
          break;
        }
        case 'add': {
          if (action.title) {
            await createGoal({
              userId,
              title: action.title,
              category: action.category || 'personal',
              metric: action.metric || null,
              targetValue: action.targetValue || null,
              currentValue: '0',
              unit: action.unit || null,
              deadline: action.deadline || null,
            });
            results.push(`Nuevo objetivo: "${action.title}"`);
          }
          break;
        }
      }
    } catch (err) {
      logger.error({ err, action }, 'Failed to apply recalibration action');
      results.push(`Error al procesar: ${action.type} ${action.goalId || action.title}`);
    }
  }

  // Generate confirmation
  const confirmation = `Listo, actualicé tus objetivos:\n${results.map((r) => `• ${r}`).join('\n')}\n\n¡Arrancamos el mes con todo! 💪`;

  logger.info({ userId, actionsApplied: results.length }, 'Recalibration complete');
  return confirmation;
}
