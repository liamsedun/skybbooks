import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db, fixedAssets, accounts, depreciationEntries, journalEntries } from '../db/schema';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { eq, and, asc, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { updateJournalEntry } from '../services/ledger.service';
import { createAuditLog, extractReqMeta } from '../services/audit.service';
import * as faService from '../services/fixedAssets.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

const assetSchema = z.object({
  assetNumber: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  assetClassId: z.string().uuid().optional().nullable(),
  purchaseDate: z.string().transform(v => new Date(v)),
  purchaseCost: z.number().int(),
  depreciationMethod: z.enum(['straight_line', 'declining_balance', 'no_depreciation']),
  usefulLifeMonths: z.number().int().min(0),
  residualValue: z.number().int().default(0),
  accountId: z.string().uuid(),
  location: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  disposalAccountId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'disposed', 'fully_depreciated', 'cwip']).optional(),
});

// ==============================
// EXISTING ENDPOINTS (preserved)
// ==============================

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const list = await faService.listAssets(req.user!.orgId!);
    return res.status(200).json(list);
  } catch (err) { return next(err); }
});

router.get('/depreciation-history', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await faService.getDepreciationHistory(req.user!.orgId!);
    return res.json(rows);
  } catch (err) { return next(err); }
});

router.get('/pdf', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { generateFixedAssetsPDF } = await import('../services/pdf.service');
    const buffer = await generateFixedAssetsPDF(req.user!.orgId!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="fixed_assets.pdf"');
    return res.end(buffer);
  } catch (err) { return next(err); }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const asset = await faService.getAsset(req.user!.orgId!, req.params.id);
    return res.status(200).json(asset);
  } catch (err) { return next(err); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = assetSchema.parse(req.body);
    const asset = await faService.createAsset(req.user!.orgId!, req.user!.userId!, body, extractReqMeta(req));
    return res.status(201).json(asset);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = assetSchema.partial().parse(req.body);
    const asset = await faService.updateAsset(req.user!.orgId!, req.user!.userId!, req.params.id, body, extractReqMeta(req));
    return res.status(200).json(asset);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.issues[0]?.message || 'Validation failed', 400));
    return next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await faService.deleteAsset(req.user!.orgId!, req.user!.userId!, req.params.id, extractReqMeta(req));
    return res.status(200).json({ message: 'Fixed asset deleted.' });
  } catch (err) { return next(err); }
});

router.post('/import-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string' || !csvData.trim()) throw new AppError('CSV data is required.', 400);

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

    const orgAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
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
      const purchaseDate = dateIdx >= 0 && row[dateIdx]?.trim() ? new Date(row[dateIdx].trim()) : new Date();
      if (isNaN(purchaseDate.getTime())) { errors.push(`Row ${i + 2}: invalid date "${row[dateIdx]}"`); continue; }
      const methodRaw = methodIdx >= 0 ? row[methodIdx]?.trim().toLowerCase().replace(/[\s-]+/g, '_') : 'straight_line';
      const method = ['straight_line', 'declining_balance', 'no_depreciation'].includes(methodRaw) ? methodRaw : 'straight_line';
      const life = lifeIdx >= 0 ? parseInt(row[lifeIdx]?.trim() || '60', 10) : 60;
      if (isNaN(life) || life < 1) { errors.push(`Row ${i + 2}: invalid useful life`); continue; }
      const residualRaw = residualIdx >= 0 ? row[residualIdx]?.replace(/[₦,]/g, '') : '0';
      const residual = Math.round(parseFloat(residualRaw) * 100);
      const category = categoryIdx >= 0 ? row[categoryIdx]?.trim() || null : null;
      let accountId = '';
      if (accCodeIdx >= 0 && row[accCodeIdx]?.trim()) {
        const accCode = row[accCodeIdx].trim(); const acc = accountByCode.get(accCode);
        if (acc) accountId = acc.id;
        else errors.push(`Row ${i + 2}: account code "${accCode}" not found`);
      }
      if (!accountId && defaultAccount) accountId = defaultAccount.id;
      const assetNumber = `FA-${orgId.slice(0, 4)}-${Date.now()}-${i}`;
      const bookValue = cost - residual;
      const [asset] = await db.insert(fixedAssets).values({
        orgId, assetNumber, name, category, purchaseDate, purchaseCost: cost,
        accumulatedDepreciation: 0, bookValue, depreciationMethod: method as any,
        usefulLifeMonths: life, residualValue: residual, accountId, status: 'active',
      }).returning();
      created.push(asset);
    }
    createAuditLog({ orgId, userId, action: 'import', entityType: 'fixed-asset', newValues: { count: created.length }, ...extractReqMeta(req) });
    return res.status(201).json({ success: true, message: `Imported ${created.length} fixed asset(s) successfully.${errors.length > 0 ? ` ${errors.length} error(s).` : ''}`, created, errors: errors.length > 0 ? errors : undefined });
  } catch (err) { next(err); }
});

router.get('/export-csv', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const list = await faService.listAssets(req.user!.orgId!);
    const csvHeader = 'Asset #,Name,Category,Purchase Date,Purchase Cost (NGN),Depreciation Method,Useful Life (months),Residual Value (NGN),Accumulated Depreciation (NGN),Book Value (NGN),Status,Location,Department\r\n';
    const csvRows = list.map(a => {
      const date = a.purchaseDate.toISOString().split('T')[0];
      const methodLabel = a.depreciationMethod === 'straight_line' ? 'Straight Line' : a.depreciationMethod === 'declining_balance' ? 'Declining Balance' : 'No Depreciation';
      return `${a.assetNumber},"${a.name.replace(/"/g, '""')}",${a.category || ''},${date},${(a.purchaseCost / 100).toFixed(2)},${methodLabel},${a.usefulLifeMonths},${(a.residualValue / 100).toFixed(2)},${(a.accumulatedDepreciation / 100).toFixed(2)},${(a.bookValue / 100).toFixed(2)},${a.status},${a.location || ''},${a.department || ''}`;
    }).join('\r\n');
    const csv = '\uFEFF' + csvHeader + csvRows;
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fixed_assets.csv"');
    return res.end(csv);
  } catch (err) { next(err); }
});

router.post('/bulk-delete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const deleted = await faService.bulkDeleteAssets(req.user!.orgId!, req.user!.userId!, req.body.ids, extractReqMeta(req));
    return res.status(200).json({ message: `Deleted ${deleted.length} asset(s).`, count: deleted.length });
  } catch (err) { next(err); }
});

router.post('/run-depreciation', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await faService.runDepreciation(req.user!.orgId!, req.user!.userId!, req.body.periodDate, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

router.patch('/depreciation-entries/:entryId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const userId = req.user!.userId!;
    const { entryId } = req.params;
    const body = z.object({
      lines: z.array(z.object({ id: z.string().optional(), accountId: z.string(), debitAmount: z.number(), creditAmount: z.number(), description: z.string().optional() })),
    }).parse(req.body);
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, entryId), eq(journalEntries.orgId, orgId))).limit(1);
    if (!entry) throw new AppError('Journal entry not found.', 404);
    const updated = await updateJournalEntry(entryId, { date: entry.date, description: entry.description || '', lines: body.lines.map(l => ({ id: l.id, accountId: l.accountId, debitAmount: l.debitAmount, creditAmount: l.creditAmount, description: l.description || '' })) });
    createAuditLog({ orgId, userId, action: 'update', entityType: 'depreciation-entry', entityId: entryId, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(updated);
  } catch (err) { return next(err); }
});

// ==============================
// NEW: ASSET CLASSES
// ==============================

router.get('/classes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const classes = await faService.getAssetClasses(req.user!.orgId!);
    return res.json(classes);
  } catch (err) { return next(err); }
});

router.post('/classes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cls = await faService.createAssetClass(req.user!.orgId!, req.body);
    createAuditLog({ orgId: req.user!.orgId!, userId: req.user!.userId!, action: 'create', entityType: 'asset-class', entityId: cls.id, newValues: req.body, ...extractReqMeta(req) });
    return res.status(201).json(cls);
  } catch (err) { return next(err); }
});

router.put('/classes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cls = await faService.updateAssetClass(req.params.id, req.user!.orgId!, req.body);
    return res.json(cls);
  } catch (err) { return next(err); }
});

router.delete('/classes/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cls = await faService.deleteAssetClass(req.params.id, req.user!.orgId!);
    return res.json({ message: 'Asset class deleted.' });
  } catch (err) { return next(err); }
});

// ==============================
// NEW: COMPONENTS
// ==============================

router.get('/:id/components', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const comps = await faService.getComponents(req.user!.orgId!, req.params.id);
    return res.json(comps);
  } catch (err) { return next(err); }
});

router.post('/:id/components', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const comp = await faService.createComponent(req.user!.orgId!, req.user!.userId!, req.params.id, req.body, extractReqMeta(req));
    return res.status(201).json(comp);
  } catch (err) { return next(err); }
});

router.put('/components/:componentId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const comp = await faService.updateComponent(req.user!.orgId!, req.user!.userId!, req.params.componentId, req.body, extractReqMeta(req));
    return res.json(comp);
  } catch (err) { return next(err); }
});

router.delete('/components/:componentId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await faService.deleteComponent(req.user!.orgId!, req.user!.userId!, req.params.componentId, extractReqMeta(req));
    return res.json({ message: 'Component deleted.' });
  } catch (err) { return next(err); }
});

// ==============================
// NEW: REVALUATION
// ==============================

router.post('/:id/revalue', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await faService.performRevaluation(req.user!.orgId!, req.user!.userId!, {
      assetId: req.params.id, revaluationDate: req.body.revaluationDate, newCarryingAmount: req.body.newCarryingAmount, notes: req.body.notes,
    }, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

router.get('/revaluations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const revaluations = await faService.getRevaluationHistory(req.user!.orgId!, req.query.assetId as string | undefined);
    return res.json(revaluations);
  } catch (err) { return next(err); }
});

// ==============================
// NEW: IMPAIRMENT
// ==============================

router.post('/:id/impair', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await faService.performImpairment(req.user!.orgId!, req.user!.userId!, {
      assetId: req.params.id, impairmentDate: req.body.impairmentDate, recoverableAmount: req.body.recoverableAmount, impairmentSource: req.body.impairmentSource, notes: req.body.notes,
    }, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

router.get('/impairments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const impairments = await faService.getImpairmentHistory(req.user!.orgId!, req.query.assetId as string | undefined);
    return res.json(impairments);
  } catch (err) { return next(err); }
});

// ==============================
// NEW: DISPOSAL
// ==============================

router.post('/:id/dispose', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await faService.disposeAsset(req.user!.orgId!, req.user!.userId!, {
      assetId: req.params.id, disposalDate: req.body.disposalDate, disposalAmount: req.body.disposalAmount, disposalAccountId: req.body.disposalAccountId, notes: req.body.notes,
    }, extractReqMeta(req));
    return res.json(result);
  } catch (err) { return next(err); }
});

// ==============================
// NEW: TRANSFER
// ==============================

router.post('/:id/transfer', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transfer = await faService.transferAsset(req.user!.orgId!, req.user!.userId!, {
      assetId: req.params.id, transferDate: req.body.transferDate, toLocation: req.body.toLocation,
      toDepartment: req.body.toDepartment, reason: req.body.reason, authorizedBy: req.body.authorizedBy, notes: req.body.notes,
    }, extractReqMeta(req));
    return res.status(201).json(transfer);
  } catch (err) { return next(err); }
});

router.get('/:id/transfers', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transfers = await faService.getTransferHistory(req.user!.orgId!, req.params.id);
    return res.json(transfers);
  } catch (err) { return next(err); }
});

// ==============================
// NEW: MAINTENANCE
// ==============================

router.post('/:id/maintenance', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const record = await faService.addMaintenanceRecord(req.user!.orgId!, req.user!.userId!, {
      assetId: req.params.id, maintenanceDate: req.body.maintenanceDate, maintenanceType: req.body.maintenanceType,
      description: req.body.description, cost: req.body.cost, vendor: req.body.vendor, notes: req.body.notes, journalEntryId: req.body.journalEntryId,
    }, extractReqMeta(req));
    return res.status(201).json(record);
  } catch (err) { return next(err); }
});

router.get('/:id/maintenance', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const records = await faService.getMaintenanceHistory(req.user!.orgId!, req.params.id);
    return res.json(records);
  } catch (err) { return next(err); }
});

// ==============================
// NEW: CWIP CAPITALIZATION
// ==============================

router.post('/capitalize-cwip', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const asset = await faService.capitalizeCwip(req.user!.orgId!, req.user!.userId!, {
      cwipAssetId: req.body.cwipAssetId, capitalizationDate: req.body.capitalizationDate,
      newAssetName: req.body.newAssetName, newAssetNumber: req.body.newAssetNumber, accountId: req.body.accountId,
      usefulLifeMonths: req.body.usefulLifeMonths, depreciationMethod: req.body.depreciationMethod,
      residualValue: req.body.residualValue, location: req.body.location, department: req.body.department,
    }, extractReqMeta(req));
    return res.status(201).json(asset);
  } catch (err) { return next(err); }
});

// ==============================
// NEW: IFRS REPORTS
// ==============================

router.get('/reports/register', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const report = await faService.getFixedAssetRegister(req.user!.orgId!);
    return res.json(report);
  } catch (err) { return next(err); }
});

router.get('/reports/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await faService.getAssetSummary(req.user!.orgId!);
    return res.json(summary);
  } catch (err) { return next(err); }
});

router.get('/reports/aging', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const aging = await faService.getAssetAging(req.user!.orgId!);
    return res.json(aging);
  } catch (err) { return next(err); }
});

router.get('/reports/movement-schedule', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) throw new AppError('fromDate and toDate are required.', 400);
    const schedule = await faService.getAssetMovementSchedule(req.user!.orgId!, fromDate as string, toDate as string);
    return res.json(schedule);
  } catch (err) { return next(err); }
});

export default router;
