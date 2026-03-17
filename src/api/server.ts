import express from 'express';
import cors from 'cors';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { router } from './routes.js';
import { resolve } from 'path';

export function startApiServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // API routes
  app.use('/api', router);

  // Serve PWA static files (built frontend)
  const webDistPath = resolve('web/dist');
  app.use(express.static(webDistPath));

  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(resolve(webDistPath, 'index.html'));
  });

  app.listen(config.apiPort, () => {
    logger.info({ port: config.apiPort }, 'API server running');
  });
}
