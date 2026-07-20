import { Router, Response } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { aiLimiter } from '../middleware/rateLimiters';
import { ok } from '../lib/response';
import { ValidationError } from '../lib/errors';
import * as nvidia from '../services/nvidia.service';
import { getProfitAndLoss, getBalanceSheet, getCashFlowStatement, getTrialBalance } from '../services/ledger.service';
import { db, accounts } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

const router = Router();

router.use(authenticate);
router.use(requireOrg);
router.use(aiLimiter);

// ── Assistant Query ──

router.post('/assistant/query', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.body;
  if (!query) throw new ValidationError('Query is required.', { query: ['Required'] });
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;

  const ctx = await buildDataContext(orgId);

  const response = await nvidia.queryFinancialData(orgId, userId, query, ctx);
  res.json(ok({ response, data: ctx }));
}));

// ── Categorise Transaction ──

router.post('/categorise', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { description, amountKobo } = req.body;
  if (!description || amountKobo == null) throw new ValidationError('description and amountKobo required.', { description: ['Required'], amountKobo: ['Required'] });
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;

  const accts = await db.select({ code: accounts.code, name: accounts.name }).from(accounts).where(eq(accounts.orgId, orgId));
  const categories = accts.filter(a => /^(4|5|6|7|8|9)/.test(a.code));

  const result = await nvidia.categoriseTransaction(orgId, userId, description, Number(amountKobo), categories);
  res.json(ok(result));
}));

// ── OCR Extract ──

router.post('/ocr/extract', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { rawText, mimeType } = req.body;
  if (!rawText) throw new ValidationError('rawText is required.', { rawText: ['Required'] });
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;

  const result = await nvidia.extractDocumentData(orgId, userId, rawText, mimeType || 'text/plain');
  res.json(ok(result));
}));

// ── Helpers ──

async function buildDataContext(orgId: string): Promise<string> {
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const currentMonth = currentDate.slice(0, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [pl, bs, cf, tb] = await Promise.all([
    getProfitAndLoss(orgId, monthStart, monthEnd).catch(() => null),
    getBalanceSheet(orgId, now).catch(() => null),
    getCashFlowStatement(orgId, monthStart, now).catch(() => null),
    getTrialBalance(orgId, monthStart, now).catch(() => null),
  ]);

  let ctx = `Financial Data for Period: ${currentMonth}\n`;
  ctx += `Report Date: ${currentDate}\n\n`;

  if (pl) {
    ctx += `=== INCOME STATEMENT ===\n`;
    (pl as any).sections?.forEach((s: any) => {
      ctx += `${s.label}: ₦${((s.total || 0) / 100).toLocaleString()}\n`;
      s.items?.forEach((i: any) => { ctx += `  ${i.label}: ₦${((i.amount || 0) / 100).toLocaleString()}\n`; });
    });
    ctx += `\n`;
  }

  if (bs) {
    ctx += `=== BALANCE SHEET ===\n`;
    (bs as any).sections?.forEach((s: any) => {
      ctx += `${s.label}: ₦${((s.total || 0) / 100).toLocaleString()}\n`;
      s.subSections?.forEach((sub: any) => {
        ctx += `  ${sub.label}: ₦${((sub.total || 0) / 100).toLocaleString()}\n`;
        sub.items?.forEach((i: any) => { ctx += `    ${i.label}: ₦${((i.amount || 0) / 100).toLocaleString()}\n`; });
      });
    });
    ctx += `\n`;
  }

  if (cf) {
    ctx += `=== CASH FLOW ===\n`;
    (cf as any).sections?.forEach((s: any) => {
      ctx += `${s.label}: ₦${((s.total || 0) / 100).toLocaleString()}\n`;
      s.items?.forEach((i: any) => { ctx += `  ${i.label}: ₦${((i.amount || 0) / 100).toLocaleString()}\n`; });
    });
    ctx += `\n`;
  }

  if (tb) {
    ctx += `=== TRIAL BALANCE (top accounts) ===\n`;
    (tb as any).rows?.slice(0, 30).forEach((r: any) => {
      ctx += `${r.code} ${r.name}: DR ₦${((r.debit || 0) / 100).toLocaleString()} / CR ₦${((r.credit || 0) / 100).toLocaleString()}\n`;
    });
    ctx += `\n`;
  }

  return ctx;
}

export default router;
