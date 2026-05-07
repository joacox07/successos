import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  WASocket,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { handleMessage } from './handler.js';
import { mkdirSync, rmSync } from 'fs';

let sock: WASocket | null = null;
let currentQR: string | null = null;
let waConnected = false;
let lastConnectedAt = 0;
const baileysLogger = pino({ level: 'silent' });

export function getConnectionStatus() {
  return { qr: currentQR, connected: waConnected };
}

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
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info({ version, isLatest }, 'Using WA version');

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    logger: baileysLogger,
    version,
    browser: Browsers.ubuntu('Chrome'),
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      waConnected = false;
      console.log('\n\n======================================================');
      console.log('  Escaneá este QR con WhatsApp:');
      console.log('  WhatsApp > Dispositivos Vinculados > Vincular dispositivo');
      console.log('======================================================\n');
      qrcode.generate(qr, { small: true });
      logger.info('QR code displayed — scan with WhatsApp or visit /qr in browser');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        // Don't reset retryCount if connection was open less than 30s (unstable)
        const stableConnection = (Date.now() - lastConnectedAt) > 30000;
        const nextRetry = stableConnection ? 0 : retryCount + 1;
        const delay = Math.min(3000 * Math.pow(2, nextRetry), 120000);
        logger.warn({ statusCode, delay, retry: nextRetry }, 'Disconnected, reconnecting...');
        setTimeout(() => connectToWhatsApp(nextRetry), delay);
      } else {
        logger.warn('Logged out from WhatsApp — clearing session and requesting new QR...');
        // Clear corrupted auth so next connect shows QR
        try {
          rmSync(config.authDir, { recursive: true, force: true });
          mkdirSync(config.authDir, { recursive: true });
        } catch (e) {
          logger.error({ err: e }, 'Failed to clear auth dir');
        }
        setTimeout(() => connectToWhatsApp(0), 3000);
      }
    }

    if (connection === 'open') {
      currentQR = null;
      waConnected = true;
      lastConnectedAt = Date.now();
      if (retryCount > 0) {
        notifyAdmin(`Bot reconnected after ${retryCount} retries`);
      }
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
