import { getOpenAI } from './openai.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { COACH_SYSTEM_PROMPT, buildCoachUserPrompt } from './prompts.js';

export async function generateCoachResponse(
  userText: string,
  extractedData: Record<string, unknown>,
  goals: { id: number; title: string; category: string; currentValue: string | null; targetValue: string | null; unit: string | null }[],
  recentPatterns: { description: string | null }[],
  conversationHistory?: { role: string; content: string }[],
): Promise<string> {
  const openai = getOpenAI();

  const userPrompt = buildCoachUserPrompt(userText, extractedData, goals, recentPatterns, conversationHistory);

  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          { role: 'system', content: COACH_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    'coach-response',
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    logger.warn('Empty coach response');
    return 'Te escuché. Seguí así 💪';
  }

  logger.info({ responseLen: content.length }, 'Coach response generated');
  return content;
}
