/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import { createServer as createViteServer } from 'vite';

import authRouter from '../routes/auth';
import organisationsRouter from '../routes/organisations';
import salesRouter from '../routes/sales';
import purchasesRouter from '../routes/purchases';
import payrollRouter from '../routes/payroll';
import reportsRouter from '../routes/reports';
import bankingRouter from '../routes/banking';
import inventoryRouter from '../routes/inventory';
import aiRouter from '../routes/ai';

import { runMigration } from '../db/migrate';

// Initialize Winston Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

async function startServer() {
  // Execute database migrations on startup
  await runMigration();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust Render's proxy so rate-limiter reads real client IPs correctly
  app.set('trust proxy', 1);

  // --- STATIC FILES FIRST (before CORS/Helmet so assets are never blocked) ---
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(compression());
    app.use(express.static(distPath));
  }

  // Security headers with Helmet (after static so assets skip it too)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  // CORS configuration (API routes only — static assets already served above)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true
  }));

  // Response compression for API responses
  if (process.env.NODE_ENV !== 'production') {
    app.use(compression());
  }

  // JSON and URL-encoded body parser with 10mb limit
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // General rate limiter: 100 requests per minute
  // keyGenerator uses req.ip which is now correct thanks to trust proxy above
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== 'production'
  });

  // Auth rate limiter: 10 requests per minute
  const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts. Please try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== 'production'
  });

  // Apply rate limiting to API routes only
  app.use('/api/', generalLimiter);
  app.use('/api/auth', authLimiter);

  // Mount API modules
  app.use('/api/auth', authRouter);
  app.use('/api/org', organisationsRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/banking', bankingRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/ai', aiRouter);

  // Root level API health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.originalUrl} not found.` });
  });

  // Global Express error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'An unexpected error occurred building the double-entry records.';

    logger.error(`[REST API ERROR] Status ${status} on ${req.method} ${req.url}:`, err);

    res.status(status).json({
      error: message,
      status
    });
  });

  // Dev mode: delegate to Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // SPA fallback: all non-API, non-asset routes serve index.html
    const distPath = path.join(process.cwd(), 'dist');
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`FinanceOS core server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
});
