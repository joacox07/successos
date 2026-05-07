import express from 'express';
import cors from 'cors';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { router } from './routes.js';
import { resolve } from 'path';
import { getConnectionStatus } from '../whatsapp/connection.js';

export function startApiServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // QR code page for WhatsApp pairing (no auth needed)
  app.get('/qr', (_req, res) => {
    const { qr, connected } = getConnectionStatus();
    if (connected) {
      return res.send(`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SuccessOS</title></head>
        <body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
        <div style="text-align:center"><h1 style="color:#4ade80">&#10003; WhatsApp conectado</h1><p>El bot esta funcionando.</p></div></body></html>`);
    }
    if (!qr) {
      return res.send(`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="3"><title>SuccessOS - Esperando QR</title></head>
        <body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
        <div style="text-align:center"><h2>Esperando QR...</h2><p>Esta pagina se recarga automaticamente.</p></div></body></html>`);
    }
    // Render QR as SVG using a simple table-based approach
    const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
    res.send(`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="20"><title>SuccessOS - Escanear QR</title></head>
      <body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
      <div style="text-align:center">
        <h2>Escaneá este QR con WhatsApp</h2>
        <p style="color:#888;font-size:14px">WhatsApp &gt; Dispositivos Vinculados &gt; Vincular dispositivo</p>
        <img src="${qrSvgUrl}" alt="QR Code" style="border-radius:12px;margin:20px auto;background:#fff;padding:16px"/>
        <p style="color:#666;font-size:12px">Se recarga cada 20 seg. Si expira, espera al proximo.</p>
      </div></body></html>`);
  });

  // API routes
  app.use('/api', router);

  // Global error handler for API — always return JSON, never HTML
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err: err.message, stack: err.stack }, 'API error');
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  });

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
