import {
  WASocket,
  WAMessage,
  getContentType,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { sendText } from './sender.js';
import {
  findUserByPhone,
  createUser,
  getActiveGoals,
  getTodayEntry,
  getActivePatterns,
  logMessage,
  getRecentMessagesAsc,
} from '../db/repository.js';
import { transcribeAudio } from '../ai/transcriber.js';
import { extractData } from '../ai/extractor.js';
import { generateCoachResponse } from '../ai/coach.js';
import { trackExtraction } from '../engine/tracker.js';
import { handleOnboardingMessage } from '../engine/onboarding.js';
import { processRecalibration } from '../engine/recalibration.js';
import { STATUS_PROMPT } from '../ai/prompts.js';

const RECALIBRATION_KEYWORDS = [
  'cambiar objetivo', 'cambiar meta', 'ajustar objetivo', 'ajustar meta',
  'pausar objetivo', 'pausar meta', 'nuevo objetivo', 'nueva meta',
  'agregar objetivo', 'completé el objetivo', 'completé mi objetivo',
  'quiero cambiar', 'subir la meta', 'bajar la meta',
];

// Quick log patterns — short messages that just log data
const QUICK_LOG_PATTERN = /^[\w\sáéíóúñü.,]+\d+\s*(hs?|hrs?|min|km|pag|pages?|\$|usd|ars|kg|lts?|cal|rep|reps|sets?)/i;
const STATUS_KEYWORDS = ['como vengo', 'cómo vengo', 'status', 'resumen', 'estado', 'como voy', 'cómo voy', 'progreso'];
const HELP_KEYWORDS = ['ayuda', 'help', 'comandos', 'qué puedo hacer', 'que puedo hacer'];

function getTodayDate(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

function isQuickLog(text: string): boolean {
  return text.length <= config.quickLogMaxLength && QUICK_LOG_PATTERN.test(text.trim());
}

function isStatusRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return STATUS_KEYWORDS.some((kw) => lower.includes(kw));
}

function isHelpRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return HELP_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw));
}

function isTrivialMessage(text: string): boolean {
  return config.trivialPatterns.test(text.trim());
}

const HELP_MESSAGE = `*SuccessOS — Comandos*

Podés escribirme lo que sea naturalmente (texto o audio) y yo extraigo los datos. Además:

• *"status"* o *"cómo vengo"* — Tu progreso actual
• *"resumen"* — Resumen del día
• *"ayuda"* — Este mensaje
• *"cambiar objetivo"* — Modificar tus metas
• *"nuevo objetivo"* — Agregar una meta nueva

También podés mandar logs rápidos:
• "gym 1hr" • "dormí 6hs" • "leí 30 pag"

Y para el resto, contame tu día como si hablaras con un amigo 🎯`;

export async function handleMessage(sock: WASocket, msg: WAMessage) {
  const jid = msg.key.remoteJid;
  if (!jid || jid === 'status@broadcast') return;

  const contentType = getContentType(msg.message!);
  logger.info({ jid, contentType, msgId: msg.key.id }, 'Message received');

  // Extract text content
  let text: string | null = null;
  let audioBuffer: Buffer | null = null;
  const incomingContentType = contentType === 'audioMessage' ? 'audio' : 'text';

  if (contentType === 'conversation') {
    text = msg.message!.conversation || null;
  } else if (contentType === 'extendedTextMessage') {
    text = msg.message!.extendedTextMessage?.text || null;
  } else if (contentType === 'audioMessage') {
    try {
      audioBuffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: console as any, reuploadRequest: sock.updateMediaMessage },
      ) as Buffer;
    } catch (err) {
      logger.error({ err }, 'Failed to download audio');
      await sendText(sock, jid, 'No pude escuchar el audio, ¿me lo mandás de nuevo o escribime?');
      return;
    }
  }

  // Get or create user
  let user = await findUserByPhone(jid);
  if (!user) {
    user = await createUser(jid);
    logger.info({ userId: user.id, phone: jid }, 'New user created');
  }

  // Transcribe audio to text
  if (audioBuffer) {
    try {
      text = await transcribeAudio(audioBuffer);
      logger.info({ userId: user.id, textLen: text.length }, 'Audio transcribed');
    } catch (err) {
      logger.error({ err }, 'Transcription failed');
      await sendText(sock, jid, 'No pude escuchar el audio, ¿me lo mandás de nuevo o escribime?');
      return;
    }
  }

  if (!text) return;

  // Log incoming message
  const inMsg = await logMessage({
    userId: user.id,
    direction: 'in',
    contentType: incomingContentType,
    rawContent: text,
  });

  // ── Onboarding check ──
  if (!user.onboardingComplete) {
    const response = await handleOnboardingMessage(user, text, sock, jid);
    if (response) {
      await logMessage({
        userId: user.id,
        direction: 'out',
        contentType: 'text',
        rawContent: response,
      });
    }
    return;
  }

  // ── Help command ──
  if (isHelpRequest(text)) {
    await sendText(sock, jid, HELP_MESSAGE);
    await logMessage({ userId: user.id, direction: 'out', contentType: 'text', rawContent: HELP_MESSAGE });
    return;
  }

  // ── Trivial message filter ──
  if (isTrivialMessage(text)) {
    logger.debug({ userId: user.id, text }, 'Trivial message, skipping AI');
    return;
  }

  // ── Recalibration check ──
  const textLower = text.toLowerCase();
  if (RECALIBRATION_KEYWORDS.some((kw) => textLower.includes(kw))) {
    try {
      const response = await processRecalibration(user.id, text);
      await sendText(sock, jid, response);
      await logMessage({
        userId: user.id,
        direction: 'out',
        contentType: 'text',
        rawContent: response,
      });
      return;
    } catch (err) {
      logger.error({ err }, 'Recalibration failed');
    }
  }

  // ── Context setup ──
  const timezone = user.timezone || 'America/Argentina/Buenos_Aires';
  const date = getTodayDate(timezone);
  const goals = await getActiveGoals(user.id);
  const todayEntry = await getTodayEntry(user.id, date);
  const patterns = await getActivePatterns(user.id);

  const goalsForExtraction = goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    metric: g.metric,
    unit: g.unit,
  }));

  // ── Status request ──
  if (isStatusRequest(text)) {
    const goalsForCoach = goals.map((g) => ({
      id: g.id, title: g.title, category: g.category,
      currentValue: g.currentValue, targetValue: g.targetValue, unit: g.unit,
    }));
    const recentMsgs = await getRecentMessagesAsc(user.id, config.conversationContextLimit);
    const history = recentMsgs.map((m) => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.rawContent || '',
    }));

    let response: string;
    try {
      response = await generateCoachResponse(
        STATUS_PROMPT,
        (todayEntry as Record<string, unknown>) || {},
        goalsForCoach,
        patterns.map((p) => ({ description: p.description })),
        history,
      );
    } catch {
      response = 'No pude generar el resumen ahora. Intentá de nuevo en un rato.';
    }

    await sendText(sock, jid, response);
    await logMessage({ userId: user.id, direction: 'out', contentType: 'text', rawContent: response });
    return;
  }

  // ── Quick log path (short messages, no coaching response needed) ──
  if (isQuickLog(text)) {
    let extraction;
    try {
      extraction = await extractData(text, goalsForExtraction, todayEntry as Record<string, unknown> | null);
    } catch (err) {
      logger.error({ err }, 'Quick log extraction failed');
      await sendText(sock, jid, 'No entendí eso. ¿Me lo decís de otra forma?');
      return;
    }

    try {
      await trackExtraction(user.id, timezone, extraction, inMsg.id);
    } catch (err) {
      logger.error({ err }, 'Quick log tracking failed');
    }

    const confirmation = 'Anotado ✓';
    await sendText(sock, jid, confirmation);
    await logMessage({
      userId: user.id,
      direction: 'out',
      contentType: 'text',
      rawContent: confirmation,
      extractedData: extraction,
    });
    return;
  }

  // ── Full message flow: extract → track → coach → respond ──

  // 1. Extract structured data
  let extraction;
  try {
    extraction = await extractData(text, goalsForExtraction, todayEntry as Record<string, unknown> | null);
  } catch (err) {
    logger.error({ err }, 'Extraction failed');
    await sendText(sock, jid, 'Te escuché, lo anoto');
    return;
  }

  // 2. Track extracted data
  try {
    await trackExtraction(user.id, timezone, extraction, inMsg.id);
  } catch (err) {
    logger.error({ err }, 'Tracking failed');
  }

  // 3. Get conversation history for context
  const recentMsgs = await getRecentMessagesAsc(user.id, config.conversationContextLimit);
  const conversationHistory = recentMsgs.map((m) => ({
    role: m.direction === 'in' ? 'user' : 'assistant',
    content: m.rawContent || '',
  }));

  // 4. Generate coaching response with context
  const goalsForCoach = goals.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    currentValue: g.currentValue,
    targetValue: g.targetValue,
    unit: g.unit,
  }));

  let response: string;
  try {
    response = await generateCoachResponse(
      text,
      extraction as unknown as Record<string, unknown>,
      goalsForCoach,
      patterns.map((p) => ({ description: p.description })),
      conversationHistory,
    );
  } catch (err) {
    logger.error({ err }, 'Coach response failed');
    response = 'Te escuché, lo anoto. Seguí así 💪';
  }

  // 5. Send response
  await sendText(sock, jid, response);

  // 6. Log outgoing message
  await logMessage({
    userId: user.id,
    direction: 'out',
    contentType: 'text',
    rawContent: response,
    extractedData: extraction,
  });
}
