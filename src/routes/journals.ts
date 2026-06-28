import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, journalEntries, journalLines, accounts } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debitAmount: z.number().int().min(0).default(0),
  creditAmount: z.number().int().min(0).default(0),
  description: z.string().optional().nullable(),
});

const journalEntrySchema = z.object({
  entryNumber: z.string().min(1),
  date: z.string().transform(v => new Date(v)),
  description: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  lines: z.array(journalLineSchema).min(2, 'Journal must have at least 2 lines'),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.orgId, orgId))
      .orderBy(desc(journalEntries.date));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.orgId, orgId)))
      .limit(1);
    if (!entry) throw new AppError('Journal entry not found.', 404);
    const lines = await db
      .select()
      .from(journalLines)
      .where(eq(journalLines.entryId, id));
    return res.status(200).json({ ...entry, lines });
  } catch (err) { return next(err); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.id!;
    const body = journalEntrySchema.parse(req.body);

    const totalDebits = body.lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredits = body.lines.reduce((s, l) => s + l.creditAmount, 0);
    if (totalDebits !== totalCredits) {
      throw new AppError('Total debits must equal total credits.', 400);
    }

    const [entry] = await db
      .insert(journalEntries)
      .values({
        orgId,
        entryNumber: body.entryNumber,
        date: body.date,
        description: body.description,
        reference: body.reference,
        source: 'manual',
        createdBy: userId,
      })
      .returning();

    if (body.lines.length > 0) {
      await db.insert(journalLines).values(
        body.lines.map(l => ({
          entryId: entry.id,
          accountId: l.accountId,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          description: l.description,
        }))
      );
    }

    const lines = await db
      .select()
      .from(journalLines)
      .where(eq(journalLines.entryId, entry.id));

    return res.status(201).json({ ...entry, lines });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// CSV import for manual journals
router.post('/import-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.id!;
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string' || !csvData.trim()) {
      throw new AppError('CSV data is required.', 400);
    }

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

    const dateIdx = headers.findIndex(h => h.startsWith('date'));
    const entryNumIdx = headers.findIndex(h => h === 'entrynumber' || h === 'entry_number' || h === 'entry #');
    const descIdx = headers.findIndex(h => h === 'description');
    const refIdx = headers.findIndex(h => h === 'reference' || h === 'ref');
    const lineAccIdx = headers.findIndex(h => h === 'line_accountcode' || h === 'line_account_code' || h === 'accountcode');
    const lineDebitIdx = headers.findIndex(h => h === 'line_debit (ngn)' || h === 'line_debit' || h === 'debit (ngn)');
    const lineCreditIdx = headers.findIndex(h => h === 'line_credit (ngn)' || h === 'line_credit' || h === 'credit (ngn)');
    const lineDescIdx = headers.findIndex(h => h === 'line_description');

    if (dateIdx === -1 || entryNumIdx === -1 || lineAccIdx === -1) {
      throw new AppError('CSV must contain "date", "entryNumber", and "line_accountCode" columns.', 400);
    }

    // Fetch accounts map
    const allAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
    const codeToId = new Map(allAccounts.map(a => [a.code, a.id]));

    // Group by entry number
    const groups = new Map<string, { entryNumber: string; date: Date; description: string | null; reference: string | null; lines: { accountId: string; debitAmount: number; creditAmount: number; description: string | null }[] }>();
    const errors: string[] = [];
    let totalCreated = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const entryNum = row[entryNumIdx]?.trim();
      if (!entryNum) { errors.push(`Row ${i + 2}: missing entryNumber`); continue; }

      const dateStr = row[dateIdx]?.trim();
      const entryDate = dateStr ? new Date(dateStr) : new Date();
      if (isNaN(entryDate.getTime())) { errors.push(`Row ${i + 2}: invalid date "${dateStr}"`); continue; }

      const accountCode = row[lineAccIdx]?.trim();
      if (!accountCode) { errors.push(`Row ${i + 2}: missing line_accountCode`); continue; }

      const accountId = codeToId.get(accountCode);
      if (!accountId) { errors.push(`Row ${i + 2}: account code "${accountCode}" not found`); continue; }

      const debitAmount = Math.round(parseFloat(row[lineDebitIdx >= 0 ? lineDebitIdx : -1]?.replace(/[₦,]/g, '') || '0') * 100);
      const creditAmount = Math.round(parseFloat(row[lineCreditIdx >= 0 ? lineCreditIdx : -1]?.replace(/[₦,]/g, '') || '0') * 100);

      if (!groups.has(entryNum)) {
        groups.set(entryNum, {
          entryNumber: entryNum,
          date: entryDate,
          description: descIdx >= 0 ? (row[descIdx]?.trim() || null) : null,
          reference: refIdx >= 0 ? (row[refIdx]?.trim() || null) : null,
          lines: [],
        });
      }
      const group = groups.get(entryNum)!;
      group.lines.push({
        accountId,
        debitAmount,
        creditAmount,
        description: lineDescIdx >= 0 ? (row[lineDescIdx]?.trim() || null) : null,
      });
    }

    // Create journal entries
    for (const [entryNum, group] of groups) {
      const totalDebits = group.lines.reduce((s, l) => s + l.debitAmount, 0);
      const totalCredits = group.lines.reduce((s, l) => s + l.creditAmount, 0);
      if (totalDebits !== totalCredits) {
        errors.push(`Entry "${entryNum}": total debits (${totalDebits}) must equal total credits (${totalCredits}). Skipped.`);
        continue;
      }

      const [entry] = await db
        .insert(journalEntries)
        .values({
          orgId,
          entryNumber: entryNum,
          date: group.date,
          description: group.description,
          reference: group.reference,
          source: 'manual',
          createdBy: userId,
        })
        .returning();

      await db.insert(journalLines).values(
        group.lines.map(l => ({
          entryId: entry.id,
          accountId: l.accountId,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          description: l.description,
        }))
      );
      totalCreated++;
    }

    return res.status(201).json({
      success: true,
      message: `Imported ${totalCreated} journal entries successfully.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

export default router;
