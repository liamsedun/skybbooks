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
import accountantRouter from '../routes/accountant';
import journalsRouter from '../routes/journals';
import budgetsRouter from '../routes/budgets';
import fixedAssetsRouter from '../routes/fixedAssets';
import auditLogRouter from '../routes/auditLog';
import periodsRouter from '../routes/periods';

import { runMigration } from '../db/migrate';

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
  await runMigration();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust Render's proxy for correct IP detection
  app.set('trust proxy', 1);

  // Compression
  app.use(compression());

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  // CORS — allow same-origin (no Origin header) and whitelisted origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true
  }));

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiters
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== 'production'
  });

  const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: { error: 'Too many authentication attempts. Please try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== 'production'
  });

  app.use('/api/', generalLimiter);
  app.use('/api/auth/', authLimiter);

  // ==========================================
  // API ROUTES (must be before static files)
  // ==========================================
  app.use('/api/auth', authRouter);
  app.use('/api/org', organisationsRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/banking', bankingRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/accountant', accountantRouter);
  app.use('/api/journals', journalsRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/fixed-assets', fixedAssetsRouter);
  app.use('/api/audit-log', auditLogRouter);
  app.use('/api/periods', periodsRouter);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API 404 — catches unmatched /api/* routes
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route ${req.originalUrl} not found.` });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = err.statusCode || err.status || 500;
    const pgErr = err.cause?.message || err.cause?.detail || err.cause;
    const message = err.message || 'An unexpected error occurred.';
    const detail = pgErr ? `${message}: ${pgErr}` : message;
    logger.error(`[ERROR] ${status} ${req.method} ${req.url}`, err);
    res.status(status).json({ error: detail, status });
  });

  // ==========================================
  // Serve uploaded files (logos etc)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // STATIC FILES (after API routes)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback
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

