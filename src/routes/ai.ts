/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { aiService } from '../services/ai.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply auth middlewares to all AI routes
router.use(authenticate);
router.use(requireOrg);

// AI-specific rate limiter: rate-limited to 50/hour per organization, fall back to IP address
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  keyGenerator: (req: any) => {
    return req.user?.orgId || req.ip;
  },
  validate: { ip: false },
  message: { error: 'Rate limit exceeded: Max 50 AI assistant requests per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', // Skip rate limit in development for smoother editing and testing
});

router.use(aiRateLimiter);

/**
 * POST /api/ai/extract-receipt
 * Upload receipt image → returns structured extracted metadata
 */
router.post(
  '/extract-receipt',
  upload.any(),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'Receipt image file is required.' });
      }

      const file = files[0];
      const result = await aiService.extractReceiptData(
        file.buffer,
        file.mimetype,
        req.user!.orgId!,
        req.user!.userId!
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/ai/categorise-transaction
 * Takes description + amount → returns expense categorisation with reasoning
 */
router.post(
  '/categorise-transaction',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { description, amount, orgCategories } = req.body;
      if (!description || amount === undefined || !orgCategories || !Array.isArray(orgCategories)) {
        return res.status(400).json({
          error: 'Missing required body fields: description, amount, or orgCategories.',
        });
      }

      const result = await aiService.categoriseTransaction(
        description,
        Number(amount),
        orgCategories,
        req.user!.orgId!,
        req.user!.userId!
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/ai/insights/:month
 * Returns monthly CFO insights comparing current vs prior month income statements
 */
router.get(
  '/insights/:month',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { month } = req.params;
      const parsedDate = new Date(month);

      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid month format. Please provide a valid ISO date.' });
      }

      const result = await aiService.generateMonthlyInsights(
        req.user!.orgId!,
        parsedDate,
        req.user!.userId!
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/ai/suggest-description
 * Takes partialDescription → autocomplete completions
 */
router.post(
  '/suggest-description',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const partialDescription = req.body.partialDescription || req.body.partialText || '';
      const result = await aiService.suggestLineItemDescription(
        partialDescription,
        req.user!.orgId!,
        req.user!.userId!
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/ai/detect-anomalies
 * Transactions array → flags unusual activity
 */
router.post(
  '/detect-anomalies',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { transactions } = req.body;
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Required field: transactions (array of bank feeds).' });
      }

      const result = await aiService.detectAnomalies(
        req.user!.orgId!,
        transactions,
        req.user!.userId!
      );

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
