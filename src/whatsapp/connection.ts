import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { handleMessage } from './handler.js';
import { mkdirSync } from 'fs';

let sock: WASocket | null = null;
const baileysLogger = pino({ level: 'silent' });

export function getSock(): WASocket {
  if (!sock) throw new Error('WhatsApp not connected');
  return sock;
}

export async function notifyAdmin(message: string): Promise<void> {
  if (!config.adminPhone || !sock) return;
  try {
    await sock.sendMessage(config.adminPhone, { text: `[SuccessOS] ${message}` });
  } catch (err) {
    logger.error({ err }, 'Failed to notify admin');
  }
}

export async function startWhatsApp(): Promise<void> {
  mkdirSync(config.authDir, { recursive: true });
  await connectToWhatsApp();
}

async function connectToWhatsApp(retryCount = 0): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    logger: baileysLogger,
    printQRInTerminal: true,
    browser: ['SuccessOS', 'Chrome', '22.0'],
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR code displayed — scan with WhatsApp');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        const delay = Math.min(3000 * Math.pow(2, retryCount), 60000);
        logger.warn({ statusCode, delay }, 'Disconnected, reconnecting...');
        setTimeout(() => connectToWhatsApp(retryCount + 1), delay);
      } else {
        logger.error('Logged out from WhatsApp — manual re-scan required');
        notifyAdmin('Bot logged out — manual QR re-scan required!');
      }
    }

    if (connection === 'open') {
      if (retryCount > 0) {
        notifyAdmin(`Bot reconnected after ${retryCount} retries`);
      }
      retryCount = 0;
      logger.info('WhatsApp connected');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      try {
        await handleMessage(sock!, msg);
      } catch (err) {
        logger.error({ err, msgId: msg.key.id }, 'Error handling message');
      }
    }
  });
}
