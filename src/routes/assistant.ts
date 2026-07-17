import { Router, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { accountingAssistant } from '../services/assistant.service';
import { extractReqMeta } from '../services/audit.service';

const router = Router();

router.use(authenticate);
router.use(requireOrg);

const assistantRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req: any) => req.user?.orgId || req.ip,
  validate: { xForwardedForHeader: false },
  message: { error: 'Rate limit: Max 20 AI assistant requests per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});

router.use(assistantRateLimiter);

router.post('/query', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a query string.' });
    }
    if (query.length > 2000) {
      return res.status(400).json({ error: 'Query is too long. Maximum 2000 characters.' });
    }

    const result = await accountingAssistant.processQuery(
      req.user!.orgId!,
      req.user!.userId!,
      query.trim(),
      { ipAddress: extractReqMeta(req).ipAddress || undefined, userAgent: extractReqMeta(req).userAgent || undefined }
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

router.post('/query/:capability', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { capability } = req.params;
    const { query } = req.body;

    const validCapabilities = [
      'explain-financials', 'explain-trial-balance', 'predict-cash-flow',
      'detect-fraud', 'detect-duplicates', 'generate-report', 'suggest-journal',
      'explain-ifrs', 'summarize-month', 'executive-insights', 'query-data'
    ];

    if (!validCapabilities.includes(capability)) {
      return res.status(400).json({ error: `Invalid capability. Valid: ${validCapabilities.join(', ')}` });
    }

    const q = query || `Generate a ${capability.replace(/-/g, ' ')}`;
    const meta = extractReqMeta(req);
    const result = await accountingAssistant.processQuery(
      req.user!.orgId!,
      req.user!.userId!,
      q,
      { ipAddress: meta.ipAddress || undefined, userAgent: meta.userAgent || undefined }
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

router.get('/capabilities', async (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({
    success: true,
    data: [
      { id: 'explain-financials', label: 'Explain Financial Statements', icon: 'BarChart3', description: 'Understand your P&L, Balance Sheet, and Cash Flow in plain language.' },
      { id: 'explain-trial-balance', label: 'Explain Trial Balance', icon: 'Scale', description: 'Analyze trial balance differences and unusual account balances.' },
      { id: 'predict-cash-flow', label: 'Predict Cash Flow', icon: 'TrendingUp', description: 'Forecast cash position and analyze runway.' },
      { id: 'detect-fraud', label: 'Detect Fraud', icon: 'Shield', description: 'Scan for suspicious patterns, round amounts, and anomalies.' },
      { id: 'detect-duplicates', label: 'Detect Duplicate Expenses', icon: 'Copy', description: 'Find potential duplicate payments and expenses.' },
      { id: 'generate-report', label: 'Generate Management Report', icon: 'FileText', description: 'Create a professional management report with key metrics.' },
      { id: 'suggest-journal', label: 'Suggest Journal Entry', icon: 'BookOpen', description: 'Get journal entry suggestions for any transaction.' },
      { id: 'explain-ifrs', label: 'Explain IFRS Impacts', icon: 'Library', description: 'Understand IFRS reporting standard implications for your business.' },
      { id: 'summarize-month', label: 'Summarize Monthly Performance', icon: 'Calendar', description: 'Get a concise monthly performance summary with trends.' },
      { id: 'executive-insights', label: 'Executive Insights', icon: 'Lightbulb', description: 'High-level strategic overview with CFO-level analysis.' },
    ],
  });
});

export default router;
