import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, journalEntries, journalLines, accounts } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { reverseJournalEntry } from '../services/ledger.service';

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
    const { from, to, accountId } = req.query;

    let query = sql`SELECT
        je.id, je.org_id AS "orgId", je.entry_number AS "entryNumber",
        je.description, je.source, je.source_id AS "sourceId",
        je.reference, je.date, je.is_reversed AS "isReversed",
        je.created_by AS "createdBy", je.created_at AS "createdAt",
        COALESCE(t.td, 0) AS "totalDebits", COALESCE(t.tc, 0) AS "totalCredits"
      FROM journal_entries je
      LEFT JOIN (
        SELECT jl.entry_id,
          SUM(CASE WHEN jl.debit_amount > 0 THEN jl.debit_amount ELSE 0 END) AS td,
          SUM(CASE WHEN jl.credit_amount > 0 THEN jl.credit_amount ELSE 0 END) AS tc
        FROM journal_lines jl GROUP BY jl.entry_id
      ) t ON je.id = t.entry_id
      WHERE je.org_id = ${orgId}::uuid`;
    if (from && typeof from === 'string' && from.trim()) {
      query = sql`${query} AND je.date >= ${from}::date`;
    }
    if (to && typeof to === 'string' && to.trim()) {
      query = sql`${query} AND je.date <= ${to}::date`;
    }
    if (accountId && typeof accountId === 'string' && accountId.trim()) {
      query = sql`${query} AND EXISTS (SELECT 1 FROM journal_lines jl2 WHERE jl2.entry_id = je.id AND jl2.account_id = ${accountId}::uuid)`;
    }
    query = sql`${query} ORDER BY je.date DESC`;

    const result = await db.execute(query);
    return res.status(200).json(result.rows || result);
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
    const userId = req.user!.userId;
    const body = journalEntrySchema.parse(req.body);

    const totalDebits = body.lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredits = body.lines.reduce((s, l) => s + l.creditAmount, 0);
    if (totalDebits !== totalCredits) {
      throw new AppError('Total debits must equal total credits.', 400);
    }

    const result = await db.transaction(async (tx) => {
      const [entry] = await tx
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
        await tx.insert(journalLines).values(
          body.lines.map(l => ({
            entryId: entry.id,
            accountId: l.accountId,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            description: l.description,
          }))
        );
      }

      const lines = await tx
        .select()
        .from(journalLines)
        .where(eq(journalLines.entryId, entry.id));

      return { ...entry, lines };
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

// CSV import for manual journals
router.post('/import-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
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

    // Create journal entries (each entry wrapped in its own transaction)
    for (const [entryNum, group] of groups) {
      const totalDebits = group.lines.reduce((s, l) => s + l.debitAmount, 0);
      const totalCredits = group.lines.reduce((s, l) => s + l.creditAmount, 0);
      if (totalDebits !== totalCredits) {
        errors.push(`Entry "${entryNum}": total debits (${totalDebits}) must equal total credits (${totalCredits}). Skipped.`);
        continue;
      }

      await db.transaction(async (tx) => {
        const [entry] = await tx
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

        await tx.insert(journalLines).values(
          group.lines.map(l => ({
            entryId: entry.id,
            accountId: l.accountId,
            debitAmount: l.debitAmount,
            creditAmount: l.creditAmount,
            description: l.description,
          }))
        );
      });
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

// Reverse a manual journal entry
router.post('/:id/reverse', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId;
    const { id } = req.params;

    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.orgId, orgId)))
      .limit(1);
    if (!entry) throw new AppError('Journal entry not found.', 404);
    if (entry.source !== 'manual') throw new AppError('Only manual journal entries can be reversed here.', 400);
    if (entry.isReversed) throw new AppError('This entry has already been reversed.', 400);

    const reversal = await reverseJournalEntry(id, new Date(), userId);

    return res.status(200).json({ message: 'Entry reversed successfully.', reversal });
  } catch (err) { return next(err); }
});

export default router;
