import { WASocket } from '@whiskeysockets/baileys';
import { getOpenAI } from '../ai/openai.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { sendText } from '../whatsapp/sender.js';
import {
  updateUser,
  upsertProfile,
  createGoal,
  getOnboardingState,
  upsertOnboardingState,
  deleteOnboardingState,
} from '../db/repository.js';
import {
  ONBOARDING_PROMPTS,
  ONBOARDING_STEP1_EXTRACTION_PROMPT,
  ONBOARDING_STEP2_EXTRACTION_PROMPT,
  ONBOARDING_SCHEDULE_PROMPT,
} from '../ai/prompts.js';

/*
  Onboarding steps (3 conversational steps + welcome):
  0 → send welcome (ask name + goals together)
  1 → received name + goals → ask for details + life context
  2 → received details → ask for schedule
  3 → received schedule → finalize everything
*/

interface ParsedGoal {
  title: string;
  category: string;
  description: string;
  metric?: string;
  targetValue?: string;
  unit?: string;
  deadline?: string | null;
  priority?: number;
}

interface OnboardingData {
  name?: string;
  parsedGoals?: ParsedGoal[];
  lifeContext?: unknown;
  obstacles?: string[];
  rawAnswers?: Record<string, string>;
}

async function aiParse(systemPrompt: string, userContent: string): Promise<unknown> {
  const openai = getOpenAI();
  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: config.llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    'onboarding-ai-parse',
  );
  const raw = response.choices[0]?.message?.content || '{}';
  return JSON.parse(raw);
}

async function getPersistedState(userId: number): Promise<OnboardingData> {
  const state = await getOnboardingState(userId);
  if (state?.data) {
    return state.data as OnboardingData;
  }
  return {};
}

async function saveState(userId: number, step: number, data: OnboardingData) {
  await upsertOnboardingState(userId, step, data);
}

export async function handleOnboardingMessage(
  user: { id: number; onboardingStep: number | null; phone: string; name?: string | null },
  text: string,
  sock: WASocket,
  jid: string,
): Promise<string | null> {
  const step = user.onboardingStep ?? 0;
  const data = await getPersistedState(user.id);

  logger.info({ userId: user.id, step }, 'Onboarding step');

  switch (step) {
    case 0: {
      // First message — send welcome (asks for name + goals together)
      const response = ONBOARDING_PROMPTS.welcome;
      await sendText(sock, jid, response);
      await updateUser(user.id, { onboardingStep: 1 });
      await saveState(user.id, 1, { rawAnswers: {} });
      return response;
    }

    case 1: {
      // Received name + goals (or partial)
      data.rawAnswers = data.rawAnswers || {};
      data.rawAnswers.step1 = (data.rawAnswers.step1 ? data.rawAnswers.step1 + '\n' : '') + text;

      try {
        const parsed = await aiParse(
          ONBOARDING_STEP1_EXTRACTION_PROMPT,
          data.rawAnswers.step1,
        ) as { name?: string | null; goals?: ParsedGoal[] };

        if (parsed.name) {
          data.name = parsed.name;
          await updateUser(user.id, { name: parsed.name });
        }

        if (parsed.goals && parsed.goals.length > 0) {
          data.parsedGoals = parsed.goals;
        }

        // If we have name but no goals, ask for goals
        if (data.name && (!data.parsedGoals || data.parsedGoals.length === 0)) {
          await saveState(user.id, 1, data);
          const response = ONBOARDING_PROMPTS.askGoalsOnly(data.name);
          await sendText(sock, jid, response);
          return response;
        }

        // If we have goals but no name, ask for name
        if (!data.name && data.parsedGoals && data.parsedGoals.length > 0) {
          await saveState(user.id, 1, data);
          const response = ONBOARDING_PROMPTS.askName;
          await sendText(sock, jid, response);
          return response;
        }

        // If we have both, move to step 2
        if (data.name && data.parsedGoals && data.parsedGoals.length > 0) {
          await updateUser(user.id, { onboardingStep: 2 });
          await saveState(user.id, 2, data);
          const goalTitles = data.parsedGoals.map((g) => g.title);
          const response = ONBOARDING_PROMPTS.askDetails(data.name, goalTitles);
          await sendText(sock, jid, response);
          return response;
        }

        // Nothing parsed — try again
        const response = 'No pude entender bien. Contame tu nombre y cuáles son tus objetivos principales (ej: "Soy Joaquín y quiero facturar $10K, bajar 10kg y leer más")';
        await sendText(sock, jid, response);
        return response;
      } catch (err) {
        logger.error({ err }, 'Failed to parse step 1');
        const response = 'Tuve un problema procesando eso. ¿Me lo repetís?';
        await sendText(sock, jid, response);
        return response;
      }
    }

    case 2: {
      // Received goal details + life context
      data.rawAnswers = data.rawAnswers || {};
      data.rawAnswers.step2 = text;

      try {
        const existingGoals = (data.parsedGoals || []).map((g) => g.title).join(', ');
        const parsed = await aiParse(
          ONBOARDING_STEP2_EXTRACTION_PROMPT,
          `Objetivos existentes: ${existingGoals}\n\nRespuesta del usuario: "${text}"`,
        ) as {
          goalDetails?: Array<Partial<ParsedGoal>>;
          lifeContext?: unknown;
          obstacles?: string[];
        };

        // Merge goal details with existing parsed goals
        if (parsed.goalDetails && data.parsedGoals) {
          for (const detail of parsed.goalDetails) {
            const existing = data.parsedGoals.find(
              (g) => g.title.toLowerCase().includes(detail.title?.toLowerCase() || '') ||
                     detail.title?.toLowerCase().includes(g.title.toLowerCase()),
            );
            if (existing) {
              Object.assign(existing, {
                metric: detail.metric || existing.metric,
                targetValue: detail.targetValue || existing.targetValue,
                unit: detail.unit || existing.unit,
                deadline: detail.deadline ?? existing.deadline,
                priority: detail.priority || existing.priority,
              });
            }
          }
        }

        if (parsed.lifeContext) data.lifeContext = parsed.lifeContext;
        if (parsed.obstacles) data.obstacles = parsed.obstacles;

        // Move to step 3 — ask schedule
        await updateUser(user.id, { onboardingStep: 3 });
        await saveState(user.id, 3, data);
        const response = ONBOARDING_PROMPTS.askSchedule(data.name || '');
        await sendText(sock, jid, response);
        return response;
      } catch (err) {
        logger.error({ err }, 'Failed to parse step 2');
        // Move on anyway with what we have
        await updateUser(user.id, { onboardingStep: 3 });
        await saveState(user.id, 3, data);
        const response = ONBOARDING_PROMPTS.askSchedule(data.name || '');
        await sendText(sock, jid, response);
        return response;
      }
    }

    case 3: {
      // Received schedule — finalize everything
      try {
        const schedule = await aiParse(ONBOARDING_SCHEDULE_PROMPT, text) as { morning?: string; evening?: string };

        // Save profile
        await upsertProfile(user.id, {
          lifeContext: data.lifeContext || {},
          obstacles: data.obstacles || [],
          rawAnswers: data.rawAnswers || {},
        });

        // Create goals in DB
        const parsedGoals = data.parsedGoals || [];
        const createdGoals: string[] = [];
        const categoryEmojis: Record<string, string> = {
          negocio: '💼', salud: '💪', personal: '🧠',
          finanzas: '💰', relaciones: '❤️', educacion: '📚',
        };

        for (let i = 0; i < parsedGoals.length; i++) {
          const g = parsedGoals[i];
          await createGoal({
            userId: user.id,
            title: g.title,
            category: g.category || 'personal',
            description: g.description || '',
            metric: g.metric || null,
            targetValue: g.targetValue || null,
            currentValue: '0',
            unit: g.unit || null,
            deadline: g.deadline || null,
            priority: g.priority || (i + 1),
          });
          const emoji = categoryEmojis[g.category] || '🎯';
          createdGoals.push(`${i + 1}. ${emoji} ${g.title}${g.metric ? ` → ${g.metric}` : ''}`);
        }

        // Mark onboarding complete
        await updateUser(user.id, {
          onboardingComplete: true,
          onboardingStep: 4,
          morningCheckIn: schedule.morning || '07:00',
          eveningCheckIn: schedule.evening || '22:00',
        });

        // Clean up persisted state
        await deleteOnboardingState(user.id);

        const goalsSummary = createdGoals.join('\n');
        const response = ONBOARDING_PROMPTS.complete(data.name || '', goalsSummary);
        await sendText(sock, jid, response);
        return response;
      } catch (err) {
        logger.error({ err }, 'Failed to complete onboarding');
        const response = 'Hubo un error al guardar tu perfil. ¿Me repetís los horarios? (ej: "7am y 10pm")';
        await sendText(sock, jid, response);
        return response;
      }
    }

    default: {
      // Reset if somehow got here
      await updateUser(user.id, { onboardingStep: 0, onboardingComplete: false });
      await deleteOnboardingState(user.id);
      return handleOnboardingMessage({ ...user, onboardingStep: 0 }, text, sock, jid);
    }
  }
}
