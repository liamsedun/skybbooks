/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, accounts, journalEntries, journalLines } from '../db/schema';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, asc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { seedAccounts } from '../db/seedAccounts';
import { postOpeningBalances, getAccountLedger } from '../services/ledger.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const accountSchema = z.object({
  code: z.string().min(1, 'Account code is required.'),
  name: z.string().min(1, 'Account name is required.'),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  subType: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  openingBalance: z.number().optional(),
});

// GET /api/accountant/accounts
router.get('/accounts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId))
      .orderBy(accounts.code);
    return res.status(200).json(list);
  } catch (err) {
    return next(err);
  }
});

// POST /api/accountant/accounts
router.post('/accounts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = accountSchema.parse(req.body);

    const [account] = await db
      .insert(accounts)
      .values({ ...body, orgId, isSystem: false, isActive: body.isActive ?? true })
      .returning();

    return res.status(201).json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// PATCH /api/accountant/accounts/:id
router.patch('/accounts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = accountSchema.partial().parse(req.body);

    const [account] = await db
      .update(accounts)
      .set(body)
      .where(and(eq(accounts.id, id), eq(accounts.orgId, orgId)))
      .returning();

    if (!account) throw new AppError('Account not found.', 404);
    return res.status(200).json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// POST /api/accountant/accounts/seed — Load Nigerian COA template
router.post('/accounts/seed', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const result = await seedAccounts(orgId);
    return res.status(result.seeded > 0 ? 201 : 200).json(result);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/accountant/accounts/:id
router.delete('/accounts/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;

    // Prevent deletion of system accounts
    const [existing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.orgId, orgId)))
      .limit(1);

    if (!existing) throw new AppError('Account not found.', 404);
    if (existing.isSystem) throw new AppError('System accounts cannot be deleted.', 403);

    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.orgId, orgId)));
    return res.status(200).json({ message: 'Account deleted.' });
  } catch (err) {
    return next(err);
  }
});

// CSV import for accounts + opening balances
router.post('/accounts/import-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.id;
    const { csvData } = req.body;

    if (!csvData || typeof csvData !== 'string' || !csvData.trim()) {
      throw new AppError('CSV data is required.', 400);
    }

    // Parse CSV
    const cleaned = csvData.replace(/^\uFEFF/, '').replace(/\r$/, '');
    const lines = cleaned.split(/\n/).filter(Boolean);
    if (lines.length < 2) throw new AppError('CSV must have a header row and at least one data row.', 400);

    function parseCsvLine(line: string): string[] {
      const fields: string[] = []; let current = ''; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) { if (ch === '"') { if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += ch; } }
        else { if (ch === '"') { inQuotes = true; } else if (ch === ',') { fields.push(current.trim()); current = ''; } else { current += ch; } }
      }
      fields.push(current.trim()); return fields;
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const dataRows = lines.slice(1).map(l => parseCsvLine(l));

    const codeIdx = headers.findIndex(h => h.includes('code'));
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'account name' || h === 'account_name');
    const typeIdx = headers.findIndex(h => h === 'type' || h === 'account type' || h === 'account_type');
    const subTypeIdx = headers.findIndex(h => h === 'sub type' || h === 'sub_type' || h === 'subtype');
    const parentCodeIdx = headers.findIndex(h => h === 'parent code' || h === 'parent_code' || h === 'parentcode');
    const descIdx = headers.findIndex(h => h === 'description');
    const activeIdx = headers.findIndex(h => h === 'active' || h === 'is active' || h === 'is_active');
    const obIdx = headers.findIndex(h => h.includes('opening balance') || h.includes('opening_balance'));

    if (codeIdx === -1) throw new AppError('CSV must contain a "code" column.', 400);
    if (nameIdx === -1) throw new AppError('CSV must contain a "name" column.', 400);
    if (typeIdx === -1) throw new AppError('CSV must contain a "type" column (asset/liability/equity/revenue/expense).', 400);

    const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    const existingAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId));

    const existingCodes = new Set(existingAccounts.map(a => a.code));
    const parentMap = new Map(existingAccounts.map(a => [a.code, a.id]));
    const errors: string[] = [];
    const created: any[] = [];
    const obLines: { accountId: string; debit: number; credit: number }[] = [];
    let totalDebitsOb = 0;
    let totalCreditsOb = 0;

    // First pass: create accounts
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const code = row[codeIdx]?.trim();
      if (!code) { errors.push(`Row ${i + 2}: missing code`); continue; }
      if (existingCodes.has(code)) { errors.push(`Row ${i + 2}: code "${code}" already exists`); continue; }

      const name = row[nameIdx]?.trim();
      if (!name) { errors.push(`Row ${i + 2}: missing name for code "${code}"`); continue; }

      const type = row[typeIdx]?.trim().toLowerCase();
      if (!validTypes.includes(type)) { errors.push(`Row ${i + 2}: invalid type "${type}" for code "${code}"`); continue; }

      const subType = subTypeIdx >= 0 ? (row[subTypeIdx]?.trim() || null) : null;
      const parentCode = parentCodeIdx >= 0 ? (row[parentCodeIdx]?.trim() || null) : null;
      const parentId = parentCode ? (parentMap.get(parentCode) || null) : null;
      const description = descIdx >= 0 ? (row[descIdx]?.trim() || null) : null;
      const isActive = activeIdx >= 0 ? (row[activeIdx]?.trim().toLowerCase() === 'yes' || row[activeIdx]?.trim() === 'true' || row[activeIdx]?.trim() === '1' || !row[activeIdx]?.trim()) : true;
      const openingBalance = obIdx >= 0 ? Math.round(parseFloat(row[obIdx]?.replace(/[₦,]/g, '') || '0') * 100) : 0;

      const [account] = await db
        .insert(accounts)
        .values({ orgId, code, name, type, subType, parentId, description, isActive, isSystem: false, openingBalance })
        .returning();

      created.push(account);
      existingCodes.add(code);
      parentMap.set(code, account.id);

      if (openingBalance > 0) {
        const isDebitType = type === 'asset' || type === 'expense';
        if (isDebitType) {
          obLines.push({ accountId: account.id, debit: openingBalance, credit: 0 });
          totalDebitsOb += openingBalance;
        } else {
          obLines.push({ accountId: account.id, debit: 0, credit: openingBalance });
          totalCreditsOb += openingBalance;
        }
      }
    }

    // Second pass: update parentId for accounts that referenced newly created parents
    for (const rowIdx in dataRows) {
      const row = dataRows[rowIdx];
      const code = row[codeIdx]?.trim();
      const parentCode = parentCodeIdx >= 0 ? (row[parentCodeIdx]?.trim() || null) : null;
      if (code && parentCode) {
        const acc = created.find((a: any) => a.code === code);
        const parent = parentMap.get(parentCode);
        if (acc && parent && parent !== acc.id) {
          await db.update(accounts).set({ parentId: parent }).where(eq(accounts.id, acc.id));
        }
      }
    }

    // Create balanced journal entry for opening balances if debits = credits
    if (obLines.length > 0) {
      if (totalDebitsOb !== totalCreditsOb) {
        errors.push(`Opening balances are out of balance: ₦${(totalDebitsOb / 100).toFixed(2)} debits vs ₦${(totalCreditsOb / 100).toFixed(2)} credits. Accounts were created but balances not journalised.`);
      } else {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(journalEntries)
          .where(eq(journalEntries.orgId, orgId));
        const count = Number(countResult?.count || 0) + 1;
        const entryNumber = `OB-${String(count).padStart(6, '0')}`;

        const [entry] = await db.insert(journalEntries).values({
          orgId, entryNumber, date: new Date('1970-01-01'),
          description: 'Opening balances from COA import', source: 'opening_balance', createdBy: userId
        }).returning();

        for (const ob of obLines) {
          await db.insert(journalLines).values({
            entryId: entry.id, accountId: ob.accountId,
            debitAmount: ob.debit, creditAmount: ob.credit,
            currency: 'NGN'
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `Imported ${created.length} accounts successfully.`,
      created,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
});

// CSV export for Chart of Accounts
router.get('/accounts/export-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId))
      .orderBy(accounts.code);

    // Build parent code map
    const idToCode = new Map(list.map(a => [a.id, a.code]));

    const csvHeader = 'Code,Name,Type,Sub-type,Parent Code,Description,Active,Opening Balance (NGN)\r\n';
    const csvRows = list.map(a => {
      const parentCode = a.parentId ? (idToCode.get(a.parentId) || '') : '';
      const ob = (Number(a.openingBalance || 0) / 100).toFixed(2);
      return `${a.code},"${a.name.replace(/"/g, '""')}",${a.type},${a.subType || ''},${parentCode},"${(a.description || '').replace(/"/g, '""')}",${a.isActive ? 'Yes' : 'No'},${ob}`;
    }).join('\r\n');

    const csv = '\uFEFF' + csvHeader + csvRows;
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chart_of_accounts.csv"');
    return res.end(csv);
  } catch (err) {
    next(err);
  }
});

// POST /api/accountant/post-opening-balances
router.post('/post-opening-balances', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.id;
    const asOfDate = req.body.asOfDate ? new Date(req.body.asOfDate as string) : new Date();
    const result = await postOpeningBalances(orgId, userId, asOfDate);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    return next(err);
  }
});

const ledgerQuerySchema = z.object({
  startDate: z.string().transform((val) => new Date(val)),
  endDate: z.string().transform((val) => new Date(val)),
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 50),
});

// GET /api/accountant/accounts/:accountId/ledger — paginated GL lines
router.get('/accounts/:accountId/ledger', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { accountId } = req.params;
    const { startDate, endDate, page, limit } = ledgerQuerySchema.parse(req.query);
    const result = await getAccountLedger(accountId, orgId, startDate, endDate, page, limit);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    }
    return next(err);
  }
});

// =========================================================================
// PDF EXPORT ROUTES
// =========================================================================
function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  return res.end(buffer);
}

router.get('/manual-journals/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateManualJournalsPDF } = await import('../services/pdf.service');
    const orgId = req.user!.orgId!;
    const start = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const buffer = await generateManualJournalsPDF(orgId, start, end);
    return sendPdf(res, buffer, 'manual_journals.pdf');
  } catch (err) { return next(err); }
});

router.get('/accounts/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateChartOfAccountsPDF } = await import('../services/pdf.service');
    const buffer = await generateChartOfAccountsPDF(req.user!.orgId!);
    return sendPdf(res, buffer, 'chart_of_accounts.pdf');
  } catch (err) { return next(err); }
});

router.get('/budgets/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateBudgetsPDF } = await import('../services/pdf.service');
    const buffer = await generateBudgetsPDF(req.user!.orgId!);
    return sendPdf(res, buffer, 'budgets.pdf');
  } catch (err) { return next(err); }
});

export default router;

