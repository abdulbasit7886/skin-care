import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { csrfGuard } from './auth.js';
import { errorHandler, notFound } from './http.js';
import { PUBLIC_DIR } from './files.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import adminRoutes from './routes/admin.js';
import fileRoutes from './routes/files.js';
import functionRoutes from './routes/functions.js';
import publicRoutes from './routes/public.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind the host's reverse proxy (correct client IPs for rate limits)

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'frame-src': ["'self'", 'blob:'],
        'object-src': ["'self'", 'blob:'],
        'connect-src': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  // ---- API
  const api = express.Router();
  api.use(csrfGuard);
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.use('/auth', authRoutes);
  api.use('/entities', entityRoutes);
  api.use('/admin', adminRoutes);
  api.use('/files', fileRoutes);
  api.use('/functions', functionRoutes);
  api.use('/public', publicRoutes);
  api.use((req, res, next) => next(notFound('Unknown API endpoint.')));
  app.use('/api', api);

  // ---- public uploads (logos, doctor photos)
  app.use('/uploads', express.static(PUBLIC_DIR, { fallthrough: false, dotfiles: 'deny', maxAge: '7d' }));

  // ---- built frontend (production). In development Vite serves it on :5173.
  if (fs.existsSync(path.join(config.distDir, 'index.html'))) {
    app.use(express.static(config.distDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/|\/uploads\/).*/, (req, res) => res.sendFile(path.join(config.distDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
