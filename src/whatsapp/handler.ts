import {
  WASocket,
  WAMessage,
  downloadMediaMessage,
  getContentType,
} from '@whiskeysockets/baileys';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { sendText } from './sender.js';
import {
  createUser,
  findUserByPhone,
  logMessage,
} from '../db/repository.js';
import { transcribeAudio } from '../ai/transcriber.js';
import { handleOnboardingMessage } from '../engine/onboarding.js';

export async function handleMessage(sock: WASocket, msg: WAMessage) {
  const jid = msg.key.remoteJid;
  if (!jid || jid === 'status@broadcast') return;

  const contentType = getContentType(msg.message!);
  logger.info({ jid, contentType, msgId: msg.key.id }, 'Message received');

  let text: string | null = null;
  let audioBuffer: Buffer | null = null;
  let audioMimeType: string | undefined;
  const isAudio = contentType === 'audioMessage';
  const incomingContentType = isAudio ? 'audio' : 'text';

  if (contentType === 'conversation') {
    text = msg.message?.conversation || null;
  } else if (contentType === 'extendedTextMessage') {
    text = msg.message?.extendedTextMessage?.text || null;
  } else if (isAudio) {
    try {
      audioMimeType = msg.message?.audioMessage?.mimetype || undefined;
      const stream = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: console as any, reuploadRequest: sock.updateMediaMessage },
      );
      audioBuffer = Buffer.isBuffer(stream) ? stream : Buffer.from(stream as Uint8Array);
      logger.info({ jid, bufferLen: audioBuffer.length, audioMimeType }, 'Audio downloaded');
    } catch (err) {
      logger.error({ err, contentType }, 'Failed to download audio');
      await sendText(sock, jid, 'No pude escuchar el audio, ¿me lo mandás de nuevo o escribime?');
      return;
    }
  }

  let user = await findUserByPhone(jid);
  if (!user) {
    user = await createUser(jid);
    logger.info({ userId: user.id, phone: jid }, 'New user created');
  }

  if (audioBuffer) {
    try {
      text = await transcribeAudio(audioBuffer, audioMimeType);
      logger.info({ userId: user.id, textLen: text.length }, 'Audio transcribed');
    } catch (err) {
      logger.error({ err }, 'Transcription failed');
      await sendText(sock, jid, 'No pude escuchar el audio, ¿me lo mandás de nuevo o escribime?');
      return;
    }
  }

  if (!text) return;

  const textLower = text.toLowerCase();
  const calendarConnectKeywords = ['conectar calendario', 'vincular calendario', 'google calendar'];
  if (calendarConnectKeywords.some((kw) => textLower.includes(kw)) && config.googleClientId) {
    const { getAuthUrl } = await import('../calendar/gcal.js');
    const authUrl = getAuthUrl(user.id);
    const response = `Para conectar tu Google Calendar, abrí este link:\n${authUrl}`;
    await sendText(sock, jid, response);
    await logMessage({ userId: user.id, direction: 'in', contentType: incomingContentType, rawContent: text });
    await logMessage({ userId: user.id, direction: 'out', contentType: 'text', rawContent: response });
    return;
  }

  if (!user.onboardingComplete) {
    await logMessage({
      userId: user.id,
      direction: 'in',
      contentType: incomingContentType,
      rawContent: text,
    });
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

  const { processMessage } = await import('../engine/messageProcessor.js');
  const result = await processMessage(user.id, text, {
    timezone: user.timezone || 'America/Argentina/Buenos_Aires',
    contentType: incomingContentType,
  });

  if (result.response) {
    await sendText(sock, jid, result.response);
  }
}
