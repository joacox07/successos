import OpenAI from 'openai';
import { config } from '../config.js';
import { getTimeContext } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';

let openai: OpenAI | null = null;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: config.openaiApiKey });
  return openai;
}

export interface CalendarIntent {
  action: 'create' | 'delete' | 'list' | 'search' | 'none';
  summary?: string;
  description?: string;
  date?: string;       // YYYY-MM-DD
  time?: string;       // HH:MM (24hr)
  endTime?: string;    // HH:MM (24hr)
  duration?: number;   // minutes
  allDay?: boolean;
  searchQuery?: string;
  eventIndex?: number; // for delete: which event from list (1-based)
}

const CALENDAR_KEYWORDS = [
  'agenda', 'agendame', 'agendá', 'agendar', 'agendá',
  'calendario', 'calendar',
  'examen', 'parcial', 'final', 'clase', 'practica', 'prÃ¡ctica',
  'entrega', 'deadline', 'vencimiento', 'cumpleaÃ±os',
  'evento', 'reunión', 'reunion', 'turno', 'cita',
  'programar', 'programá', 'anotá', 'anotame',
  'borrar evento', 'borrar reunión', 'cancelar evento', 'cancelar reunión',
  'eliminar evento', 'eliminar reunión',
  'qué tengo', 'que tengo', 'qué hay', 'que hay',
  'mis eventos', 'mi agenda', 'mi calendario',
  'mañana tengo', 'hoy tengo',
];

/** Quick check if a message might be calendar-related. */
export function mightBeCalendarIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return CALENDAR_KEYWORDS.some((kw) => lower.includes(kw));
}

const EXTRACTION_PROMPT = `Sos un extractor de intenciones de calendario. El usuario habla en español argentino por WhatsApp.

Tu trabajo es determinar si el usuario quiere:
1. CREAR un evento ("agendame X el martes a las 3pm", "tengo reunión mañana a las 10")
2. BORRAR un evento ("borrá la reunión del martes", "cancelá el evento #2")
3. LISTAR eventos ("qué tengo hoy", "mi agenda de mañana", "eventos de la semana")
4. BUSCAR un evento específico ("cuándo es la reunión con Juan")
5. NADA relacionado con calendario → action: "none"

REGLAS:
- Convertí referencias relativas a fechas absolutas usando el contexto temporal
- "mañana" = fecha de mañana, "el martes" = el próximo martes, etc.
- Si dice hora, convertila a formato 24h (HH:MM)
- Si no dice duración ni hora de fin, dejá duration en null (se usa 1hr por defecto)
- Para "borrar", si dice "#2" o "el segundo", poné eventIndex = 2
- Si no es un pedido de calendario, respondé con action: "none"

Respondé SOLO con JSON, sin texto adicional:
{
  "action": "create" | "delete" | "list" | "search" | "none",
  "summary": "titulo del evento o null",
  "description": "descripción o null",
  "date": "YYYY-MM-DD o null",
  "time": "HH:MM o null",
  "endTime": "HH:MM o null",
  "duration": number_en_minutos_o_null,
  "allDay": true/false,
  "searchQuery": "texto de búsqueda o null",
  "eventIndex": number_o_null
}`;

export async function extractCalendarIntent(userText: string): Promise<CalendarIntent> {
  const ai = getOpenAI();
  const tc = getTimeContext();

  const userPrompt = `CONTEXTO TEMPORAL:
Hoy es ${tc.dayOfWeek}, ${tc.dateStr}
Hora actual: ${tc.time} (${tc.timeOfDay})

MENSAJE DEL USUARIO:
"${userText}"

Extraé la intención de calendario.`;

  const res = await ai.chat.completions.create({
    model: config.llmModel,
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 300,
  });

  const raw = res.choices[0]?.message?.content?.trim() || '{"action":"none"}';

  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as CalendarIntent;
    logger.info({ intent: parsed }, 'Calendar intent extracted');
    return parsed;
  } catch (err) {
    logger.error({ err, raw }, 'Failed to parse calendar intent');
    return { action: 'none' };
  }
}
