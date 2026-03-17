import { logger } from './utils/logger.js';
import { initDb } from './db/client.js';

async function main() {
  logger.info('SuccessOS API-only mode starting...');

  // Boot DB (auto-creates tables)
  initDb();
  logger.info('Database ready (tables verified)');

  // API Server (for PWA)
  const { startApiServer } = await import('./api/server.js');
  startApiServer();

  // Keep process alive
  setInterval(() => {}, 1 << 30);

  logger.info('SuccessOS API-only running');
}

main().catch((err) => {
  logger.fatal(err, 'Fatal error');
  process.exit(1);
});
