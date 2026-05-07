import { WASocket } from '@whiskeysockets/baileys';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const lastSendTimes = new Map<string, number>();

// Prevent memory leak: clean up entries older than 1 hour every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [jid, time] of lastSendTimes) {
    if (time < cutoff) lastSendTimes.delete(jid);
  }
}, 30 * 60 * 1000).unref();

async function rateLimitedSend(sock: WASocket, jid: string, content: Parameters<WASocket['sendMessage']>[1]) {
  const now = Date.now();
  const lastSend = lastSendTimes.get(jid) || 0;
  const elapsed = now - lastSend;
  if (elapsed < config.messageCooldownMs) {
    await new Promise((r) => setTimeout(r, config.messageCooldownMs - elapsed));
  }
  lastSendTimes.set(jid, Date.now());
  return sock.sendMessage(jid, content);
}

export async function sendText(sock: WASocket, jid: string, text: string) {
  logger.debug({ jid, textLen: text.length }, 'Sending text message');
  return rateLimitedSend(sock, jid, { text });
}

export async function sendTextChunked(sock: WASocket, jid: string, text: string, maxLen = 4000) {
  if (text.length <= maxLen) {
    return sendText(sock, jid, text);
  }
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let cutAt = remaining.lastIndexOf('\n', maxLen);
    if (cutAt <= 0) cutAt = maxLen;
    chunks.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  for (const chunk of chunks) {
    await sendText(sock, jid, chunk);
  }
}
