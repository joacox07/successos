import { logger } from './utils/logger.js';
import { initDb } from './db/client.js';
import { config } from './config.js';

async function main() {
  logger.info('SuccessOS v2 starting...');

  // Validate config
  if (!config.openaiApiKey) {
    logger.warn('OPENAI_API_KEY not set — AI features will fail');
  }

  // Boot DB (auto-creates tables)
  initDb();
  logger.info('Database ready (tables verified)');

  // WhatsApp connection
  const { startWhatsApp, notifyAdmin } = await import('./whatsapp/connection.js');
  await startWhatsApp();

  // Scheduler
  const { startScheduler } = await import('./scheduler/cron.js');
  startScheduler();

  // API Server (for PWA)
  const { startApiServer } = await import('./api/server.js');
  startApiServer();

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Uncaught error handling — log but don't exit (API must stay up)
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    notifyAdmin(`CRASH: ${err.message}`).catch(() => {});
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
    notifyAdmin(`Unhandled rejection: ${String(reason)}`).catch(() => {});
  });

  logger.info('SuccessOS v2 running');
}

main().catch((err) => {
  logger.fatal(err, 'Fatal error');
  process.exit(1);
});
