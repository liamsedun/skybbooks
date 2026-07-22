/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import winston from 'winston';
import { apiLimiter, authLimiter, perUserLimiter, perOrgLimiter } from '../middleware/rateLimiters';

// Global BigInt serialization for JSON responses (PostgreSQL bigint → number)
if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    const n = Number(this);
    return Number.isSafeInteger(n) ? n : this.toString();
  };
}

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import authRouter from '../routes/auth';
import platformAuthRouter from '../routes/platformAuth';
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
import customReportsRouter from '../routes/customReports';
import periodsRouter from '../routes/periods';
import platformRouter from '../routes/platform';
import notificationsRouter from '../routes/notifications';
import projectsRouter from '../routes/projects';
import vatRouter from '../routes/vat';
import taxRouter from '../routes/tax';
import legacyRouter from '../routes/legacy';
import chatRouter from '../routes/chat';
import emailSettingsRouter from '../routes/emailSettings';
import revenueRouter from '../routes/revenue';
import leasesRouter from '../routes/leases';
import eclRouter from '../routes/ecl';
import approvalRouter from '../routes/approval';
import assistantRouter from '../routes/assistant';
import ocrRouter from '../routes/ocr';
import groupsRouter from '../routes/groups';
import intercompanyRouter from '../routes/intercompany';
import consolidationRouter from '../routes/consolidation';
import passwordResetRouter from '../routes/passwordReset';
import contactRouter from '../routes/contact';
import featureFlagRouter from '../routes/featureFlags';
import platformSubscriptionRouter, { subscriptionWebhookRouter, billingWebhookRouter } from '../routes/platformSubscriptionsIndex';
import { initLifecycleScheduler } from '../routes/subscriptionLifecycle';

import usageMonitorRouter from '../routes/usageMonitor';
import apiKeysRouter from '../routes/apiKeys';
import superAdminRouter from '../routes/superAdmin';
import subscriptionNotificationsRouter from '../routes/subscriptionNotifications';
import budgetRouter from '../routes/budget';
import inventoryTrackingRouter from '../routes/inventoryTracking';
import supportRouter from '../routes/support';
import platformUsersRouter from '../routes/platformUsers';
import announcementsRouter from '../routes/announcements';
import rateLimitAdminRouter from '../routes/rateLimitAdmin';
import featureRolloutsRouter from '../routes/featureRollouts';
import dunningRouter from '../routes/dunning';
import customerSubscriptionsRouter from '../routes/customerSubscriptions';

import { runMigration } from '../db/migrate';
import { fetchLatestRates } from '../services/cbn.service';
import { requestId } from '../middleware/requestId';
import { routeGuard } from '../middleware/routeGuard';
import { AppError, ValidationError } from '../lib/errors';
import { processPaymentReminders } from '../services/reminders.service';
import { runDueRecurringBills } from '../services/recurring-bills.service';

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
  // Run migration in background so server starts immediately
  runMigration().catch(err => console.error('[Migration] Background migration failed:', err));

  // Auto-refresh currency rates on startup and every hour
  fetchLatestRates().catch(() => {});
  setInterval(() => fetchLatestRates().catch(() => {}), 60 * 60 * 1000);

  // Process recurring bills (check every 15 minutes)
  setInterval(() => runDueRecurringBills().catch((err) => logger.error('[RecurringBills] Error:', err)), 15 * 60 * 1000);

  // Send payment reminders (every 6 hours)
  setInterval(() => processPaymentReminders().catch((err) => logger.error('[Reminders] Error:', err)), 6 * 60 * 60 * 1000);

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust proxy for correct IP detection behind cPanel's Apache/nginx
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

  // Request ID for tracing
  app.use(requestId);

  // Cookie parser for SPA route guard
  app.use(cookieParser());

  // Body parsers
  // IMPORTANT: Webhook routes must be mounted BEFORE express.json()
  // so the raw body is available for HMAC signature verification.
  app.use('/api/webhooks/mono', (await import('../routes/monoWebhook')).default);
  app.use('/api/webhooks/gateway', (await import('../routes/bankingWebhooks')).default);
  app.use('/api/subscriptions', subscriptionWebhookRouter); // webhook before json parser
  app.use('/api/subscriptions', billingWebhookRouter);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiters
  app.use('/api/', apiLimiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/', perUserLimiter);
  app.use('/api/', perOrgLimiter);

  // ==========================================
  // API ROUTES (must be before static files)
  // ==========================================
  app.use('/api/auth', authRouter);
  app.use('/api/platform/auth', platformAuthRouter);
  app.use('/api/auth', passwordResetRouter);
  app.use('/api/org', organisationsRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/banking', bankingRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/inventory', inventoryTrackingRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/accountant', accountantRouter);
  app.use('/api/journals', journalsRouter);
  app.use('/api/budgets', budgetRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/fixed-assets', fixedAssetsRouter);
  app.use('/api/audit-log', auditLogRouter);
  app.use('/api/periods', periodsRouter);
  app.use('/api/platform', platformRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/custom-reports', customReportsRouter);
  app.use('/api/vat', vatRouter);
  app.use('/api/tax', taxRouter);
  app.use('/api/legacy', legacyRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/email-settings', emailSettingsRouter);
  app.use('/api/revenue', revenueRouter);
  app.use('/api/leases', leasesRouter);
  app.use('/api/ecl', eclRouter);
  app.use('/api/approval', approvalRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/ocr', ocrRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/intercompany', intercompanyRouter);
  app.use('/api/reports/consolidation', consolidationRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/feature-flags', featureFlagRouter);
  app.use('/api/reports', usageMonitorRouter);
  app.use('/api/platform/subscriptions', platformSubscriptionRouter);
  app.use('/api/platform', superAdminRouter);
  app.use('/api/platform/subscription-notifications', subscriptionNotificationsRouter);
  app.use('/api/api-keys', apiKeysRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/platform/rate-limits', rateLimitAdminRouter);
  app.use('/api/platform/feature-rollouts', featureRolloutsRouter);
  app.use('/api/platform/users', platformUsersRouter);
  app.use('/api/dunning', dunningRouter);
  app.use('/api/customer-subscriptions', customerSubscriptionsRouter);

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
    const requestId = (req as any).requestId || 'unknown';

    if (status === 401 && err.errorCode === 'TOKEN_EXPIRED') {
      logger.debug(`[${requestId}] Access token expired (expected) — ${req.method} ${req.url}`);
    } else if (status >= 500) {
      logger.error(`[${requestId}] ${status} ${req.method} ${req.url}`, err);
    } else {
      logger.warn(`[${requestId}] ${status} ${req.method} ${req.url} — ${err.message}`);
    }

    const body: Record<string, any> = {
      success: false,
      error: err.message || 'An unexpected error occurred.',
      status,
      requestId,
    };

    if (err instanceof ValidationError && err.fields) {
      body.fields = err.fields;
    }

    res.status(status).json(body);
  });

  // ==========================================
  // SPA Route Guards (before static file serving)
  // ==========================================
  app.use('/app', routeGuard);
  app.use('/platform', routeGuard);

  // ==========================================
  // Serve uploaded files (logos etc)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // STATIC FILES (after API routes)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import: keeps `vite` out of the production require graph,
    // since this branch never runs in production.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    // Rewrite SPA routes to their HTML entry points before Vite middleware
    // Only for non-file requests so static assets pass through unchanged
    app.use((req, res, next) => {
      if (req.path.startsWith('/app') && !req.path.includes('.')) {
        req.url = '/app.html';
      } else if (req.path.startsWith('/platform') && !req.path.includes('.')) {
        req.url = '/platform.html';
      }
      next();
    });

    app.use(vite.middlewares);

    // SPA fallback for unmatched routes (Vite in 'custom' mode doesn't provide one)
    app.use('*', (req, res) => {
      if (req.path.startsWith('/app')) {
        res.sendFile(path.join(process.cwd(), 'app.html'));
      } else if (req.path.startsWith('/platform')) {
        res.sendFile(path.join(process.cwd(), 'platform.html'));
      } else {
        res.sendFile(path.join(process.cwd(), 'index.html'));
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Multi-SPA fallback — serve correct HTML based on path prefix
    app.get('*', (req, res) => {
      if (req.path.startsWith('/app')) {
        res.sendFile(path.join(distPath, 'app.html'));
      } else if (req.path.startsWith('/platform')) {
        res.sendFile(path.join(distPath, 'platform.html'));
      } else {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  // Socket.IO for real-time chat
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));
      const { verifyAccessToken } = await import('../lib/tokens');
      const payload = verifyAccessToken(token as string);
      (socket as any).user = payload;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Track presence: orgId → Map<userId, Set<socketId>>
  const presence = new Map<string, Map<string, Set<string>>>();

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (!user?.orgId) {
      socket.disconnect();
      return;
    }
    const orgRoom = `org:${user.orgId}`;
    socket.join(orgRoom);
    logger.info(`[Chat] User ${user.userId} connected`);

    // ── Presence tracking ──
    if (!presence.has(user.orgId)) presence.set(user.orgId, new Map());
    const orgPresence = presence.get(user.orgId)!;
    if (!orgPresence.has(user.userId)) orgPresence.set(user.userId, new Set());
    orgPresence.get(user.userId)!.add(socket.id);
    // Broadcast updated online users to org
    const onlineIds = Array.from(orgPresence.keys()).filter(uid => (orgPresence.get(uid)?.size || 0) > 0);
    io.to(orgRoom).emit('presence:update', { onlineUserIds: onlineIds });

    // Subscribe to conversation rooms
    socket.on('chat:join', (convIds: string[]) => {
      for (const cid of convIds) {
        socket.join(`conv:${cid}`);
      }
    });

    socket.on('chat:send', async (data: { conversationId: string; message: string }) => {
      if (!data.message?.trim() || !data.conversationId) return;
      try {
        const { db, chatMessages, chatConversationParticipants, users: usersTbl } = await import('../db/schema');
        const { eq, and } = await import('drizzle-orm');

        // Verify user is a participant of this conversation
        const [part] = await db
          .select()
          .from(chatConversationParticipants)
          .where(and(
            eq(chatConversationParticipants.conversationId, data.conversationId),
            eq(chatConversationParticipants.userId, user.userId)
          ))
          .limit(1);
        if (!part) {
          socket.emit('chat:error', { error: 'Not a participant' });
          return;
        }

        const [msg] = await db.insert(chatMessages).values({
          orgId: user.orgId,
          conversationId: data.conversationId,
          userId: user.userId,
          message: data.message.trim(),
        }).returning();

        const [sender] = await db
          .select({ fullName: usersTbl.fullName })
          .from(usersTbl)
          .where(eq(usersTbl.id, user.userId))
          .limit(1);

        const payload = {
          id: msg.id,
          conversationId: msg.conversationId,
          message: msg.message,
          userId: msg.userId,
          createdAt: msg.createdAt,
          userName: sender?.fullName || 'Unknown',
        };

        io.to(`conv:${data.conversationId}`).emit('chat:message', payload);

        // Emit notification to the org room so non-active viewers see the badge
        io.to(orgRoom).emit('chat:notification', {
          conversationId: payload.conversationId,
          userName: payload.userName,
          message: payload.message,
        });
      } catch (err) {
        logger.error('[Chat] Error saving message:', err);
        socket.emit('chat:error', { error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`[Chat] User ${user.userId} disconnected`);
      // Update presence
      const orgPresence2 = presence.get(user.orgId);
      if (orgPresence2) {
        const sockets = orgPresence2.get(user.userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            orgPresence2.delete(user.userId);
          }
        }
        const onlineIds2 = Array.from(orgPresence2.keys()).filter(uid => (orgPresence2.get(uid)?.size || 0) > 0);
        io.to(orgRoom).emit('presence:update', { onlineUserIds: onlineIds2 });
      }
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`FinanceOS core server running on port ${PORT}`);
  });

  // Start subscription lifecycle scheduler
  initLifecycleScheduler();
}

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
});

