import { getOpenAI } from './openai.js';
import { GUIDE_SYSTEM_PROMPT, buildGuideUserPrompt, getCalendarChatSystemPrompt, buildCalendarChatPrompt } from './prompts.js';
import { logger } from '../utils/logger.js';

export interface CalendarChatResult {
  type: 'text' | 'create_event';
  text: string;
  eventData?: {
    summary: string;
    date: string;
    time?: string;
    endTime?: string;
    allDay: boolean;
  };
}

export async function generateGuideResponse(
  userText: string,
  correlations: { areaA: string; areaB: string; correlation: number | null; description: string | null; confidence: number | null; dataPoints: number | null }[],
  recentReport: string | null,
  history: { role: string; content: string }[],
): Promise<string> {
  const openai = getOpenAI();
  const userPrompt = buildGuideUserPrompt(userText, correlations, recentReport, history);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        { role: 'system', content: GUIDE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() ?? 'No pude generar una respuesta en este momento.';
  } catch (err) {
    logger.error({ err }, 'generateGuideResponse error');
    return 'Hubo un error al analizar los datos. Intentá de nuevo.';
  }
}

export async function generateCalendarChatResponse(
  userText: string,
  context: string,
  history?: { role: string; content: string }[],
): Promise<CalendarChatResult> {
  const openai = getOpenAI();
  const userPrompt = buildCalendarChatPrompt(userText, context);

  try {
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: getCalendarChatSystemPrompt() },
    ];

    // Include conversation history for context (e.g., user saying "si" after a question)
    if (history && history.length > 0) {
      for (const h of history.slice(-6)) {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content,
        });
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 500,
      messages,
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? '';

    // Try to detect if the AI returned a JSON event creation response
    try {
      const jsonMatch = content.match(/\{[\s\S]*"intent"\s*:\s*"create_event"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.intent === 'create_event' && parsed.event?.summary && parsed.event?.date) {
          return {
            type: 'create_event',
            text: parsed.confirmText || `Agendé "${parsed.event.summary}". ¿Algo más?`,
            eventData: {
              summary: parsed.event.summary,
              date: parsed.event.date,
              time: parsed.event.time,
              endTime: parsed.event.endTime,
              allDay: parsed.event.allDay ?? false,
            },
          };
        }
      }
    } catch {
      // Not valid JSON, treat as normal text
    }

    return { type: 'text', text: content || 'No pude generar una respuesta en este momento.' };
  } catch (err) {
    logger.error({ err }, 'generateCalendarChatResponse error');
    return { type: 'text', text: 'Hubo un error al procesar tu pregunta. Intentá de nuevo.' };
  }
}
