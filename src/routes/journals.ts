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

export default router;
