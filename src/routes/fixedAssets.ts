import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, fixedAssets, accounts } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const assetSchema = z.object({
  assetNumber: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  purchaseDate: z.string().transform(v => new Date(v)),
  purchaseCost: z.number().int(),
  depreciationMethod: z.enum(['straight_line', 'declining_balance', 'no_depreciation']),
  usefulLifeMonths: z.number().int().min(1),
  residualValue: z.number().int().default(0),
  accountId: z.string().uuid(),
  status: z.enum(['active', 'disposed', 'fully_depreciated']).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.orgId, orgId))
      .orderBy(desc(fixedAssets.createdAt));
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [asset] = await db
      .select()
      .from(fixedAssets)
      .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
      .limit(1);
    if (!asset) throw new AppError('Fixed asset not found.', 404);
    return res.status(200).json(asset);
  } catch (err) { return next(err); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const body = assetSchema.parse(req.body);
    const bookValue = body.purchaseCost - body.residualValue;

    const [asset] = await db
      .insert(fixedAssets)
      .values({
        orgId,
        assetNumber: body.assetNumber,
        name: body.name,
        category: body.category,
        purchaseDate: body.purchaseDate,
        purchaseCost: body.purchaseCost,
        accumulatedDepreciation: 0,
        bookValue,
        depreciationMethod: body.depreciationMethod,
        usefulLifeMonths: body.usefulLifeMonths,
        residualValue: body.residualValue,
        accountId: body.accountId,
        status: body.status || 'active',
      })
      .returning();

    return res.status(201).json(asset);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const body = assetSchema.partial().parse(req.body);

    if (body.purchaseCost !== undefined || body.residualValue !== undefined) {
      const [existing] = await db
        .select()
        .from(fixedAssets)
        .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
        .limit(1);
      if (existing) {
        const cost = body.purchaseCost ?? existing.purchaseCost;
        const residual = body.residualValue ?? existing.residualValue;
        (body as any).bookValue = cost - residual;
      }
    }

    const [asset] = await db
      .update(fixedAssets)
      .set(body)
      .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
      .returning();
    if (!asset) throw new AppError('Fixed asset not found.', 404);
    return res.status(200).json(asset);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { id } = req.params;
    const [asset] = await db
      .delete(fixedAssets)
      .where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId)))
      .returning();
    if (!asset) throw new AppError('Fixed asset not found.', 404);
    return res.status(200).json({ message: 'Fixed asset deleted.' });
  } catch (err) { return next(err); }
});

// CSV import for fixed assets
router.post('/import-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
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

    const nameIdx = headers.findIndex(h => h === 'name' || h === 'asset name' || h === 'asset_name');
    const costIdx = headers.findIndex(h => h.startsWith('purchase cost') || h.startsWith('cost') || h.includes('cost (ngn)') || h === 'cost');
    const dateIdx = headers.findIndex(h => h.startsWith('purchase date') || h === 'date' || h === 'purchase_date');
    const methodIdx = headers.findIndex(h => h.startsWith('depreciation method') || h.startsWith('depreciation') || h === 'method' || h === 'depreciation_method');
    const lifeIdx = headers.findIndex(h => h.startsWith('useful life') || h.startsWith('life') || h === 'months' || h === 'useful_life_months');
    const residualIdx = headers.findIndex(h => h.startsWith('residual') || h.startsWith('salvage'));
    const categoryIdx = headers.findIndex(h => h === 'category' || h === 'class');
    const accCodeIdx = headers.findIndex(h => h === 'account code' || h === 'account_code' || h === 'account');

    if (nameIdx === -1) throw new AppError('CSV must contain a "name" column.', 400);
    if (costIdx === -1) throw new AppError('CSV must contain a "cost" column.', 400);

    // Load org accounts for asset account lookup
    const orgAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.orgId, orgId));
    const accountByCode = new Map(orgAccounts.map(a => [a.code, a]));
    const assetAccounts = orgAccounts.filter(a => a.type === 'asset');
    const defaultAccount = assetAccounts[0];

    const errors: string[] = [];
    const created: any[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const name = row[nameIdx]?.trim();
      if (!name) { errors.push(`Row ${i + 2}: missing name`); continue; }

      const costStr = row[costIdx]?.replace(/[₦,]/g, '') || '0';
      const cost = Math.round(parseFloat(costStr) * 100);
      if (isNaN(cost) || cost <= 0) { errors.push(`Row ${i + 2}: invalid cost "${row[costIdx]}"`); continue; }

      const purchaseDate = dateIdx >= 0 && row[dateIdx]?.trim()
        ? new Date(row[dateIdx].trim())
        : new Date();
      if (isNaN(purchaseDate.getTime())) { errors.push(`Row ${i + 2}: invalid date "${row[dateIdx]}"`); continue; }

      const methodRaw = methodIdx >= 0 ? row[methodIdx]?.trim().toLowerCase().replace(/[\s-]+/g, '_') : 'straight_line';
      const method = ['straight_line', 'declining_balance', 'no_depreciation'].includes(methodRaw) ? methodRaw : 'straight_line';

      const life = lifeIdx >= 0 ? parseInt(row[lifeIdx]?.trim() || '60', 10) : 60;
      if (isNaN(life) || life < 1) { errors.push(`Row ${i + 2}: invalid useful life`); continue; }

      const residualRaw = residualIdx >= 0 ? row[residualIdx]?.replace(/[₦,]/g, '') : '0';
      const residual = Math.round(parseFloat(residualRaw) * 100);

      const category = categoryIdx >= 0 ? (row[categoryIdx]?.trim() || null) : null;

      let accountId = '';
      if (accCodeIdx >= 0 && row[accCodeIdx]?.trim()) {
        const accCode = row[accCodeIdx].trim();
        const acc = accountByCode.get(accCode);
        if (acc) accountId = acc.id;
        else errors.push(`Row ${i + 2}: account code "${accCode}" not found`);
      }
      if (!accountId && defaultAccount) accountId = defaultAccount.id;

      const assetNumber = `FA-${orgId.slice(0, 4)}-${Date.now()}-${i}`;
      const bookValue = cost - residual;

      const [asset] = await db
        .insert(fixedAssets)
        .values({
          orgId, assetNumber, name, category: category || null,
          purchaseDate, purchaseCost: cost, accumulatedDepreciation: 0, bookValue,
          depreciationMethod: method as any, usefulLifeMonths: life, residualValue: residual,
          accountId,
          status: 'active',
        })
        .returning();
      created.push(asset);
    }

    return res.status(201).json({
      success: true,
      message: `Imported ${created.length} fixed asset(s) successfully.${errors.length > 0 ? ` ${errors.length} error(s).` : ''}`,
      created,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// CSV export for fixed assets
router.get('/export-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await db
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.orgId, orgId))
      .orderBy(asc(fixedAssets.name));

    const csvHeader = 'Asset #,Name,Category,Purchase Date,Purchase Cost (NGN),Depreciation Method,Useful Life (months),Residual Value (NGN),Accumulated Depreciation (NGN),Book Value (NGN),Status\n';
    const csvRows = list.map(a => {
      const date = a.purchaseDate.toISOString().split('T')[0];
      const methodLabel = a.depreciationMethod === 'straight_line' ? 'Straight Line' : a.depreciationMethod === 'declining_balance' ? 'Declining Balance' : 'No Depreciation';
      return `${a.assetNumber},"${a.name.replace(/"/g, '""')}",${a.category || ''},${date},${(a.purchaseCost / 100).toFixed(2)},${methodLabel},${a.usefulLifeMonths},${(a.residualValue / 100).toFixed(2)},${(a.accumulatedDepreciation / 100).toFixed(2)},${(a.bookValue / 100).toFixed(2)},${a.status}`;
    }).join('\n');

    const csv = '\uFEFF' + csvHeader + csvRows;
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fixed_assets.csv"');
    return res.end(csv);
  } catch (err) {
    next(err);
  }
});

// Bulk delete (for clearing last import)
router.post('/bulk-delete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('ids array is required.', 400);
    }
    const deleted = await db
      .delete(fixedAssets)
      .where(and(eq(fixedAssets.orgId, orgId), sql`${fixedAssets.id} = ANY(${ids}::uuid[])`))
      .returning({ id: fixedAssets.id });
    return res.status(200).json({ message: `Deleted ${deleted.length} asset(s).`, count: deleted.length });
  } catch (err) {
    next(err);
  }
});

export default router;