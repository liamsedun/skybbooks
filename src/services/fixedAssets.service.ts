import { db, fixedAssets, assetClasses, assetComponents, revaluationEntries, impairmentEntries, maintenanceRecords, assetTransfers, depreciationEntries, accounts, journalEntries } from '../db/schema';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import { postToGL } from './posting.service';
import { createAuditLog, extractReqMeta } from './audit.service';
import { AppError } from '../lib/errors';

const FIXED_ASSET_SOURCE = 'fixed_asset' as const;

function toKobo(naira: number): number {
  return Math.round(naira * 100);
}

// ==============================
// ASSET CLASSES
// ==============================

export async function getAssetClasses(orgId: string) {
  return db.select().from(assetClasses).where(and(eq(assetClasses.orgId, orgId), eq(assetClasses.isActive, true))).orderBy(asc(assetClasses.name));
}

export async function createAssetClass(orgId: string, data: any) {
  const [cls] = await db.insert(assetClasses).values({ orgId, ...data }).returning();
  return cls;
}

export async function updateAssetClass(id: string, orgId: string, data: any) {
  const [cls] = await db.update(assetClasses).set(data).where(and(eq(assetClasses.id, id), eq(assetClasses.orgId, orgId))).returning();
  if (!cls) throw new AppError('Asset class not found.', 404);
  return cls;
}

export async function deleteAssetClass(id: string, orgId: string) {
  const [cls] = await db.delete(assetClasses).where(and(eq(assetClasses.id, id), eq(assetClasses.orgId, orgId))).returning();
  if (!cls) throw new AppError('Asset class not found.', 404);
  return cls;
}

// ==============================
// FIXED ASSETS
// ==============================

export async function listAssets(orgId: string) {
  return db.select().from(fixedAssets).where(eq(fixedAssets.orgId, orgId)).orderBy(desc(fixedAssets.createdAt));
}

export async function getAsset(orgId: string, id: string) {
  const [asset] = await db.select().from(fixedAssets).where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId))).limit(1);
  if (!asset) throw new AppError('Fixed asset not found.', 404);
  return asset;
}

export async function createAsset(orgId: string, userId: string, data: any, reqMeta?: any) {
  const bookValue = data.purchaseCost - data.residualValue;
  const [asset] = await db.insert(fixedAssets).values({
    orgId,
    assetNumber: data.assetNumber,
    name: data.name,
    category: data.category || null,
    assetClassId: data.assetClassId || null,
    purchaseDate: data.purchaseDate,
    purchaseCost: data.purchaseCost,
    accumulatedDepreciation: 0,
    bookValue,
    depreciationMethod: data.depreciationMethod || 'straight_line',
    usefulLifeMonths: data.usefulLifeMonths,
    residualValue: data.residualValue || 0,
    accountId: data.accountId,
    location: data.location || null,
    department: data.department || null,
    disposalAccountId: data.disposalAccountId || null,
    status: data.status || (data.usefulLifeMonths > 0 ? 'active' : 'cwip'),
  }).returning();
  if (reqMeta) createAuditLog({ orgId, userId, action: 'create', entityType: 'fixed-asset', entityId: asset.id, newValues: { name: data.name, purchaseCost: data.purchaseCost }, ...reqMeta });
  return asset;
}

export async function updateAsset(orgId: string, userId: string, id: string, data: any, reqMeta?: any) {
  if (data.purchaseCost !== undefined || data.residualValue !== undefined) {
    const existing = await getAsset(orgId, id);
    const cost = data.purchaseCost ?? existing.purchaseCost;
    const residual = data.residualValue ?? existing.residualValue;
    data.bookValue = cost - residual;
  }
  if (data.usefulLifeMonths !== undefined) {
    if (data.usefulLifeMonths <= 0) {
      data.depreciationMethod = 'no_depreciation';
    }
  }
  const [asset] = await db.update(fixedAssets).set(data).where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId))).returning();
  if (!asset) throw new AppError('Fixed asset not found.', 404);
  if (reqMeta) createAuditLog({ orgId, userId, action: 'update', entityType: 'fixed-asset', entityId: id, newValues: data, ...reqMeta });
  return asset;
}

export async function deleteAsset(orgId: string, userId: string, id: string, reqMeta?: any) {
  const [asset] = await db.delete(fixedAssets).where(and(eq(fixedAssets.id, id), eq(fixedAssets.orgId, orgId))).returning();
  if (!asset) throw new AppError('Fixed asset not found.', 404);
  if (reqMeta) createAuditLog({ orgId, userId, action: 'delete', entityType: 'fixed-asset', entityId: id, ...reqMeta });
  return asset;
}

export async function bulkDeleteAssets(orgId: string, userId: string, ids: string[], reqMeta?: any) {
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids array is required.', 400);
  const deleted = await db.delete(fixedAssets).where(and(eq(fixedAssets.orgId, orgId), sql`${fixedAssets.id} = ANY(${ids}::uuid[])`)).returning({ id: fixedAssets.id });
  if (reqMeta) createAuditLog({ orgId, userId, action: 'delete', entityType: 'fixed-asset', newValues: { count: deleted.length }, ...reqMeta });
  return deleted;
}

// ==============================
// COMPONENT ACCOUNTING
// ==============================

export async function getComponents(orgId: string, assetId: string) {
  return db.select().from(assetComponents).where(and(eq(assetComponents.assetId, assetId), eq(assetComponents.orgId, orgId))).orderBy(asc(assetComponents.name));
}

export async function createComponent(orgId: string, userId: string, assetId: string, data: any, reqMeta?: any) {
  const bookValue = data.cost - (data.residualValue || 0);
  const [comp] = await db.insert(assetComponents).values({
    orgId,
    assetId,
    name: data.name,
    description: data.description || null,
    cost: data.cost,
    usefulLifeMonths: data.usefulLifeMonths,
    residualValue: data.residualValue || 0,
    depreciationMethod: data.depreciationMethod || 'straight_line',
    accumulatedDepreciation: 0,
    bookValue,
    glAssetAccountId: data.glAssetAccountId || null,
    glAccumDeprAccountId: data.glAccumDeprAccountId || null,
  }).returning();
  if (reqMeta) createAuditLog({ orgId, userId, action: 'create', entityType: 'asset-component', entityId: comp.id, newValues: { name: data.name, cost: data.cost, assetId }, ...reqMeta });
  return comp;
}

export async function updateComponent(orgId: string, userId: string, id: string, data: any, reqMeta?: any) {
  if (data.cost !== undefined || data.residualValue !== undefined) {
    const [existing] = await db.select().from(assetComponents).where(and(eq(assetComponents.id, id), eq(assetComponents.orgId, orgId))).limit(1);
    if (existing) {
      const cost = data.cost ?? existing.cost;
      const residual = data.residualValue ?? existing.residualValue;
      data.bookValue = cost - residual;
    }
  }
  const [comp] = await db.update(assetComponents).set(data).where(and(eq(assetComponents.id, id), eq(assetComponents.orgId, orgId))).returning();
  if (!comp) throw new AppError('Component not found.', 404);
  if (reqMeta) createAuditLog({ orgId, userId, action: 'update', entityType: 'asset-component', entityId: id, newValues: data, ...reqMeta });
  return comp;
}

export async function deleteComponent(orgId: string, userId: string, id: string, reqMeta?: any) {
  const [comp] = await db.delete(assetComponents).where(and(eq(assetComponents.id, id), eq(assetComponents.orgId, orgId))).returning();
  if (!comp) throw new AppError('Component not found.', 404);
  if (reqMeta) createAuditLog({ orgId, userId, action: 'delete', entityType: 'asset-component', entityId: id, ...reqMeta });
  return comp;
}

// ==============================
// REVALUATION
// ==============================

export async function performRevaluation(orgId: string, userId: string, data: {
  assetId: string; revaluationDate: string; newCarryingAmount: number; notes?: string;
}, reqMeta?: any) {
  const asset = await getAsset(orgId, data.assetId);
  const oldCarrying = asset.bookValue;
  const newCarrying = data.newCarryingAmount;
  const revalAmount = Math.abs(newCarrying - oldCarrying);
  const isUpward = newCarrying > oldCarrying;

  // Find revaluation surplus account
  let surplusAccountId = asset.revaluationSurplusAccountId;
  if (!surplusAccountId) {
    const classRec = asset.assetClassId ? (await db.select().from(assetClasses).where(eq(assetClasses.id, asset.assetClassId)).limit(1))[0] : null;
    surplusAccountId = classRec?.glRevaluationReserveAccountId || null;
  }
  if (!surplusAccountId) throw new AppError('No revaluation surplus account mapped. Set one on the asset class or asset.', 400);

  // GL lines
  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
  let revaluationSurplus = 0;
  let revaluationLoss = 0;

  if (isUpward) {
    lines.push(
      { accountId: asset.accountId, debit: revalAmount, credit: 0, description: `Revaluation - ${asset.name}` },
      { accountId: surplusAccountId, debit: 0, credit: revalAmount, description: `Revaluation surplus - ${asset.name}` }
    );
    revaluationSurplus = revalAmount;
  } else {
    // Downward: first reverse any previous revaluation surplus, remaining goes to P&L
    const prevSurplus = asset.revaluationAmount > 0 ? Math.min(asset.revaluationAmount, revalAmount) : 0;
    const plLoss = revalAmount - prevSurplus;

    if (prevSurplus > 0) {
      lines.push(
        { accountId: surplusAccountId, debit: prevSurplus, credit: 0, description: `Reversal of revaluation surplus - ${asset.name}` },
        { accountId: asset.accountId, debit: 0, credit: prevSurplus, description: `Revaluation decrease - ${asset.name}` }
      );
    }
    if (plLoss > 0) {
      const impairmentAccount = await getImpairmentExpenseAccount(orgId);
      lines.push(
        { accountId: impairmentAccount.id, debit: plLoss, credit: 0, description: `Revaluation loss (impairment) - ${asset.name}` },
        { accountId: asset.accountId, debit: 0, credit: plLoss, description: `Revaluation decrease - ${asset.name}` }
      );
      revaluationLoss = plLoss;
    }
    revaluationSurplus = prevSurplus > 0 ? -prevSurplus : 0;
  }

  const je = await postToGL({
    orgId, date: new Date(data.revaluationDate),
    description: `Revaluation - ${asset.name} (${isUpward ? 'upward' : 'downward'})`,
    source: FIXED_ASSET_SOURCE, createdBy: userId, lines,
  });

  // Record revaluation entry
  const [revalEntry] = await db.insert(revaluationEntries).values({
    orgId, assetId: data.assetId, revaluationDate: new Date(data.revaluationDate),
    revaluationType: isUpward ? 'upward' : 'downward',
    oldCarryingAmount: oldCarrying, newCarryingAmount: newCarrying,
    revaluationAmount: revalAmount, revaluationSurplus, revaluationLoss,
    journalEntryId: je.id, notes: data.notes, createdBy: userId,
  }).returning();

  // Update asset with new values
  const newAccumDepr = asset.accumulatedDepreciation + (newCarrying - asset.bookValue >= 0 ? 0 : asset.bookValue - newCarrying);
  await db.update(fixedAssets).set({
    bookValue: newCarrying,
    revaluationAmount: Math.max(0, (asset.revaluationAmount || 0) + revaluationSurplus),
  }).where(eq(fixedAssets.id, data.assetId));

  if (reqMeta) createAuditLog({ orgId, userId, action: 'revalue', entityType: 'fixed-asset', entityId: data.assetId, newValues: { oldCarrying, newCarrying, revalAmount }, ...reqMeta });
  return { revaluation: revalEntry, journalEntry: je };
}

// ==============================
// IMPAIRMENT
// ==============================

export async function getImpairmentExpenseAccount(orgId: string) {
  const acc = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, '830000'))).limit(1);
  if (acc.length > 0) return acc[0];
  // Fallback: find any impairment account
  const fallback = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), sql`name ILIKE '%impairment%'`)).limit(1);
  if (fallback.length > 0) return fallback[0];
  throw new AppError('Impairment loss account (830000) not found. Please create one.', 400);
}

export async function performImpairment(orgId: string, userId: string, data: {
  assetId: string; impairmentDate: string; recoverableAmount: number; impairmentSource?: string; notes?: string;
}, reqMeta?: any) {
  const asset = await getAsset(orgId, data.assetId);
  const carryingAmount = asset.bookValue;
  const recoverableAmount = data.recoverableAmount;
  const impairmentLoss = Math.max(0, carryingAmount - recoverableAmount);

  if (impairmentLoss <= 0) throw new AppError('Asset is not impaired (carrying amount <= recoverable amount).', 400);

  const expenseAccount = await getImpairmentExpenseAccount(orgId);

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
  let remainingLoss = impairmentLoss;

  // Reverse any revaluation surplus first
  if (asset.revaluationAmount > 0) {
    const surplusReversal = Math.min(asset.revaluationAmount, remainingLoss);
    const surplusAccountId = asset.revaluationSurplusAccountId;
    if (surplusAccountId) {
      lines.push(
        { accountId: surplusAccountId, debit: surplusReversal, credit: 0, description: `Reversal of revaluation surplus - ${asset.name}` },
        { accountId: asset.accountId, debit: 0, credit: surplusReversal, description: `Impairment - ${asset.name}` }
      );
    }
    remainingLoss -= surplusReversal;
  }

  if (remainingLoss > 0) {
    lines.push(
      { accountId: expenseAccount.id, debit: remainingLoss, credit: 0, description: `Impairment loss - ${asset.name}` },
      { accountId: asset.accountId, debit: 0, credit: remainingLoss, description: `Impairment - ${asset.name}` }
    );
  }

  const je = await postToGL({
    orgId, date: new Date(data.impairmentDate),
    description: `Impairment - ${asset.name}`,
    source: FIXED_ASSET_SOURCE, createdBy: userId, lines,
  });

  const [impEntry] = await db.insert(impairmentEntries).values({
    orgId, assetId: data.assetId, impairmentDate: new Date(data.impairmentDate),
    carryingAmount, recoverableAmount, impairmentLoss, impairmentSource: data.impairmentSource || null,
    journalEntryId: je.id, notes: data.notes, createdBy: userId,
  }).returning();

  const newBookValue = carryingAmount - impairmentLoss;
  await db.update(fixedAssets).set({ bookValue: newBookValue, impairmentLoss: (asset.impairmentLoss || 0) + impairmentLoss }).where(eq(fixedAssets.id, data.assetId));

  if (reqMeta) createAuditLog({ orgId, userId, action: 'impair', entityType: 'fixed-asset', entityId: data.assetId, newValues: { carryingAmount, recoverableAmount, impairmentLoss }, ...reqMeta });
  return { impairment: impEntry, journalEntry: je };
}

// ==============================
// DISPOSAL
// ==============================

export async function disposeAsset(orgId: string, userId: string, data: {
  assetId: string; disposalDate: string; disposalAmount: number; disposalAccountId?: string; notes?: string;
}, reqMeta?: any) {
  const asset = await getAsset(orgId, data.assetId);
  if (asset.status === 'disposed') throw new AppError('Asset is already disposed.', 400);

  const disposalAmount = data.disposalAmount;
  const nbv = asset.bookValue;
  const gainLoss = disposalAmount - nbv;

  // Find disposal proceeds/loss accounts
  let proceedsAccountId = data.disposalAccountId || asset.disposalAccountId;
  if (!proceedsAccountId && asset.assetClassId) {
    const classRec = (await db.select().from(assetClasses).where(eq(assetClasses.id, asset.assetClassId)).limit(1))[0];
    proceedsAccountId = classRec?.glDisposalProceedsAccountId || null;
  }
  if (!proceedsAccountId) {
    // Default: try seeded accounts
    const proceedsAcc = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, '601400'))).limit(1))[0];
    proceedsAccountId = proceedsAcc?.id || asset.accountId;
  }

  let lossAccountId: string | undefined;
  if (gainLoss < 0) {
    const lossAcc = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, '830600'))).limit(1))[0];
    lossAccountId = lossAcc?.id || asset.accountId;
  }

  // Remove accumulated depreciation: DR accum depr account, CR asset account
  const orgAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
  const accountByCode = new Map(orgAccounts.map(a => [a.code, a]));
  const assetAccount = orgAccounts.find(a => a.id === asset.accountId);
  let accDeprAccountId: string | null = null;
  if (assetAccount) {
    let accDeprCode = assetAccount.code.slice(0, -1) + '1' + assetAccount.code.slice(-1);
    const tryCode = assetAccount.code.slice(0, -2) + '01';
    if (accountByCode.has(tryCode)) accDeprCode = tryCode;
    const accDeprAcc = accountByCode.get(accDeprCode);
    if (accDeprAcc) accDeprAccountId = accDeprAcc.id;
  }

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];

  // Remove accumulated depreciation
  if (accDeprAccountId && asset.accumulatedDepreciation > 0) {
    lines.push(
      { accountId: accDeprAccountId, debit: asset.accumulatedDepreciation, credit: 0, description: `Removal of accum depr - ${asset.name}` },
      { accountId: asset.accountId, debit: 0, credit: asset.accumulatedDepreciation, description: `Derecognition - ${asset.name}` }
    );
  }

  // Record disposal proceeds
  if (disposalAmount > 0) {
    lines.push(
      { accountId: proceedsAccountId, debit: 0, credit: disposalAmount, description: `Disposal proceeds - ${asset.name}` }
    );
  }

  // Record loss (credit the asset account for remaining NBV)
  const remainingNbv = nbv - (asset.accumulatedDepreciation > 0 ? 0 : 0);
  if (gainLoss < 0 && lossAccountId) {
    lines.push(
      { accountId: lossAccountId, debit: Math.abs(gainLoss), credit: 0, description: `Loss on disposal - ${asset.name}` }
    );
  } else if (gainLoss > 0) {
    lines.push(
      { accountId: proceedsAccountId, debit: 0, credit: gainLoss, description: `Gain on disposal - ${asset.name}` }
    );
  }

  if (lines.length === 0) throw new AppError('No journal lines generated for disposal.', 400);

  const je = await postToGL({
    orgId, date: new Date(data.disposalDate),
    description: `Disposal - ${asset.name} (${asset.assetNumber})`,
    source: FIXED_ASSET_SOURCE, createdBy: userId, lines,
  });

  await db.update(fixedAssets).set({
    status: 'disposed', disposalDate: new Date(data.disposalDate),
    disposalAmount, bookValue: 0,
  }).where(eq(fixedAssets.id, data.assetId));

  if (reqMeta) createAuditLog({ orgId, userId, action: 'dispose', entityType: 'fixed-asset', entityId: data.assetId, newValues: { disposalAmount, gainLoss, nbv }, ...reqMeta });
  return { journalEntry: je, gainLoss };
}

// ==============================
// TRANSFER
// ==============================

export async function transferAsset(orgId: string, userId: string, data: {
  assetId: string; transferDate: string; toLocation?: string; toDepartment?: string; reason?: string; authorizedBy?: string; notes?: string;
}, reqMeta?: any) {
  const asset = await getAsset(orgId, data.assetId);
  const [transfer] = await db.insert(assetTransfers).values({
    orgId, assetId: data.assetId, transferDate: new Date(data.transferDate),
    fromLocation: asset.location || null, toLocation: data.toLocation || null,
    fromDepartment: asset.department || null, toDepartment: data.toDepartment || null,
    reason: data.reason || null, authorizedBy: data.authorizedBy || null, notes: data.notes || null, createdBy: userId,
  }).returning();

  const updates: any = {};
  if (data.toLocation !== undefined) updates.location = data.toLocation;
  if (data.toDepartment !== undefined) updates.department = data.toDepartment;
  if (Object.keys(updates).length > 0) {
    await db.update(fixedAssets).set(updates).where(eq(fixedAssets.id, data.assetId));
  }

  if (reqMeta) createAuditLog({ orgId, userId, action: 'transfer', entityType: 'fixed-asset', entityId: data.assetId, newValues: { fromLocation: asset.location, toLocation: data.toLocation, fromDepartment: asset.department, toDepartment: data.toDepartment }, ...reqMeta });
  return transfer;
}

export async function getTransferHistory(orgId: string, assetId: string) {
  return db.select().from(assetTransfers).where(and(eq(assetTransfers.assetId, assetId), eq(assetTransfers.orgId, orgId))).orderBy(desc(assetTransfers.transferDate));
}

// ==============================
// MAINTENANCE
// ==============================

export async function addMaintenanceRecord(orgId: string, userId: string, data: {
  assetId: string; maintenanceDate: string; maintenanceType: string; description: string; cost: number; vendor?: string; notes?: string; journalEntryId?: string;
}, reqMeta?: any) {
  const isCapitalizable = data.maintenanceType === 'overhaul' && data.cost > 50000000;
  if (isCapitalizable) {
    const asset = await getAsset(orgId, data.assetId);
    await db.update(fixedAssets).set({
      purchaseCost: asset.purchaseCost + data.cost,
      bookValue: asset.bookValue + data.cost,
    }).where(eq(fixedAssets.id, data.assetId));
  }

  const [record] = await db.insert(maintenanceRecords).values({
    orgId, assetId: data.assetId, maintenanceDate: new Date(data.maintenanceDate),
    maintenanceType: data.maintenanceType, description: data.description,
    cost: data.cost, vendor: data.vendor || null,
    journalEntryId: data.journalEntryId || null,
    notes: data.notes || null, createdBy: userId,
  }).returning();

  if (reqMeta) createAuditLog({ orgId, userId, action: 'maintenance', entityType: 'fixed-asset', entityId: data.assetId, newValues: { maintenanceType: data.maintenanceType, cost: data.cost }, ...reqMeta });
  return record;
}

export async function getMaintenanceHistory(orgId: string, assetId: string) {
  return db.select().from(maintenanceRecords).where(and(eq(maintenanceRecords.assetId, assetId), eq(maintenanceRecords.orgId, orgId))).orderBy(desc(maintenanceRecords.maintenanceDate));
}

// ==============================
// CWIP
// ==============================

export async function capitalizeCwip(orgId: string, userId: string, data: {
  cwipAssetId: string; capitalizationDate: string; newAssetName?: string; newAssetNumber?: string; accountId?: string; usefulLifeMonths?: number; depreciationMethod?: string; residualValue?: number; location?: string; department?: string;
}, reqMeta?: any) {
  const cwipAsset = await getAsset(orgId, data.cwipAssetId);
  if (cwipAsset.status !== 'cwip') throw new AppError('Asset is not a CWIP.', 400);

  // Create new capitalized asset
  const totalCost = cwipAsset.purchaseCost;
  const life = data.usefulLifeMonths || 60;
  const method = data.depreciationMethod || 'straight_line';
  const residual = data.residualValue || 0;
  const bookValue = totalCost - residual;

  const [newAsset] = await db.insert(fixedAssets).values({
    orgId, assetNumber: data.newAssetNumber || `FA-${orgId.slice(0, 4)}-${Date.now()}`,
    name: data.newAssetName || cwipAsset.name,
    category: cwipAsset.category,
    assetClassId: cwipAsset.assetClassId,
    purchaseDate: new Date(data.capitalizationDate),
    purchaseCost: totalCost, accumulatedDepreciation: 0, bookValue,
    depreciationMethod: method as any, usefulLifeMonths: life,
    residualValue: residual, accountId: data.accountId || cwipAsset.accountId,
    location: data.location || cwipAsset.location || null,
    department: data.department || cwipAsset.department || null,
    capitalizationDate: new Date(data.capitalizationDate),
    cwipSourceId: data.cwipAssetId,
    status: 'active',
  }).returning();

  // Mark CWIP as disposed/capitalized
  await db.update(fixedAssets).set({ status: 'disposed', disposalDate: new Date(data.capitalizationDate) }).where(eq(fixedAssets.id, data.cwipAssetId));

  // Generate JW between CWIP account and new asset account
  await postToGL({
    orgId, date: new Date(data.capitalizationDate),
    description: `Capitalization of CWIP: ${cwipAsset.name} → ${newAsset.name}`,
    source: FIXED_ASSET_SOURCE, createdBy: userId,
    lines: [
      { accountId: newAsset.accountId, debit: totalCost, credit: 0, description: `Capitalized asset - ${newAsset.name}` },
      { accountId: cwipAsset.accountId, debit: 0, credit: totalCost, description: `CWIP transfer out - ${cwipAsset.name}` },
    ],
  });

  if (reqMeta) createAuditLog({ orgId, userId, action: 'capitalize', entityType: 'fixed-asset', entityId: newAsset.id, newValues: { fromCwip: data.cwipAssetId, newAssetName: newAsset.name }, ...reqMeta });
  return newAsset;
}

// ==============================
// DEPRECIATION ENGINE
// ==============================

export async function runDepreciation(orgId: string, userId: string, periodDate?: string, reqMeta?: any) {
  const period = periodDate ? new Date(periodDate) : new Date();
  period.setHours(0, 0, 0, 0);

  // Get all active, depreciable assets AND their components
  const assetList = await db.select().from(fixedAssets)
    .where(and(eq(fixedAssets.orgId, orgId), eq(fixedAssets.status, 'active'), sql`${fixedAssets.depreciationMethod} != 'no_depreciation'`));

  if (assetList.length === 0) {
    return { success: true, message: 'No depreciable assets found.', entries: 0 };
  }

  // Get components for all assets
  const assetIds = assetList.map(a => a.id);
  const allComponents = assetIds.length > 0 ? await db.select().from(assetComponents)
    .where(and(sql`${assetComponents.assetId} = ANY(${assetIds}::uuid[])`, eq(assetComponents.isActive, true))) : [];

  const orgAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
  const accountByCode = new Map(orgAccounts.map(a => [a.code, a]));
  const accountById = new Map(orgAccounts.map(a => [a.id, a]));

  const deprExpenseAccount = orgAccounts.find(a => a.code === '810700');
  if (!deprExpenseAccount) throw new AppError('Depreciation expense account (810700) not found.', 400);

  const countResult = await db.execute(sql`
    SELECT count(*)::int AS cnt FROM depreciation_entries de
    JOIN fixed_assets fa ON fa.id = de.asset_id WHERE fa.org_id = ${orgId}
  `);
  let nextNum = Number(countResult.rows[0]?.cnt || 0);

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
  const entryRows: { assetId: string; periodDate: Date; amount: number; entryNumber: string; isComponent?: boolean; componentId?: string }[] = [];
  const assetUpdates: { id: string; accumulatedDepreciation: number; bookValue: number; status: string }[] = [];
  const compUpdates: { id: string; accumulatedDepreciation: number; bookValue: number }[] = [];

  for (const asset of assetList) {
    const comps = allComponents.filter(c => c.assetId === asset.id);

    if (comps.length > 0) {
      // Component-level depreciation
      for (const comp of comps) {
        const deprBase = comp.cost - comp.residualValue;
        if (deprBase <= 0) continue;
        const monthlyDepr = comp.depreciationMethod === 'straight_line'
          ? Math.round(deprBase / comp.usefulLifeMonths)
          : comp.depreciationMethod === 'declining_balance'
            ? Math.round(comp.bookValue * (2 / comp.usefulLifeMonths))
            : 0;
        if (monthlyDepr <= 0) continue;
        const remaining = comp.bookValue - comp.residualValue;
        if (remaining <= 0) continue;
        const actualDepr = Math.min(monthlyDepr, remaining);

        const deprAccId = comp.glAccumDeprAccountId || getAccumDeprAccountId(asset.accountId, orgAccounts, accountByCode);
        if (!deprAccId) continue;

        lines.push(
          { accountId: deprExpenseAccount.id, debit: actualDepr, credit: 0, description: `Depreciation - ${asset.name} / ${comp.name}` },
          { accountId: deprAccId, debit: 0, credit: actualDepr, description: `Accum depr - ${asset.name} / ${comp.name}` }
        );

        nextNum++;
        entryRows.push({ assetId: asset.id, periodDate: period, amount: actualDepr, entryNumber: `DE-${String(nextNum).padStart(6, '0')}` });

        compUpdates.push({
          id: comp.id,
          accumulatedDepreciation: comp.accumulatedDepreciation + actualDepr,
          bookValue: comp.cost - (comp.accumulatedDepreciation + actualDepr),
        });
      }
    } else {
      // Asset-level depreciation (no components)
      const deprBase = asset.purchaseCost - asset.residualValue;
      if (deprBase <= 0) continue;

      let monthlyDepr = 0;
      if (asset.depreciationMethod === 'straight_line') {
        monthlyDepr = Math.round(deprBase / asset.usefulLifeMonths);
      } else if (asset.depreciationMethod === 'declining_balance') {
        monthlyDepr = Math.round(asset.bookValue * (2 / asset.usefulLifeMonths));
      }
      if (monthlyDepr <= 0) continue;
      const remaining = asset.bookValue - asset.residualValue;
      if (remaining <= 0) continue;
      const actualDepr = Math.min(monthlyDepr, remaining);

      const accDeprAccountId = getAccumDeprAccountId(asset.accountId, orgAccounts, accountByCode);
      if (!accDeprAccountId) continue;

      lines.push(
        { accountId: deprExpenseAccount.id, debit: actualDepr, credit: 0, description: `Depreciation - ${asset.name}` },
        { accountId: accDeprAccountId, debit: 0, credit: actualDepr, description: `Accumulated depreciation - ${asset.name}` }
      );

      nextNum++;
      entryRows.push({ assetId: asset.id, periodDate: period, amount: actualDepr, entryNumber: `DE-${String(nextNum).padStart(6, '0')}` });

      const newAccumulated = asset.accumulatedDepreciation + actualDepr;
      const newBookValue = asset.purchaseCost - newAccumulated + asset.revaluationAmount;
      const newStatus = newBookValue <= asset.residualValue ? 'fully_depreciated' : 'active';
      assetUpdates.push({ id: asset.id, accumulatedDepreciation: newAccumulated, bookValue: newBookValue, status: newStatus });
    }
  }

  if (lines.length === 0) {
    return { success: true, message: 'No depreciation to post.', entries: 0 };
  }

  const journalEntry = await postToGL({
    orgId, date: period,
    description: `Monthly depreciation - ${period.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    source: FIXED_ASSET_SOURCE, createdBy: userId, lines,
  });

  for (const row of entryRows) {
    await db.insert(depreciationEntries).values({
      assetId: row.assetId, periodDate: row.periodDate, amount: row.amount,
      journalEntryId: journalEntry.id, entryNumber: row.entryNumber,
    });
  }

  for (const upd of assetUpdates) {
    await db.update(fixedAssets).set({
      accumulatedDepreciation: upd.accumulatedDepreciation,
      bookValue: upd.bookValue, status: upd.status as any,
      lastDepreciationDate: period,
    }).where(eq(fixedAssets.id, upd.id));
  }

  for (const upd of compUpdates) {
    await db.update(assetComponents).set({
      accumulatedDepreciation: upd.accumulatedDepreciation,
      bookValue: upd.bookValue,
    }).where(eq(assetComponents.id, upd.id));
  }

  if (reqMeta) createAuditLog({ orgId, userId, action: 'depreciate', entityType: 'fixed-asset', newValues: { entriesCreated: entryRows.length }, ...reqMeta });
  return {
    success: true,
    message: `Depreciation run complete. Posted for ${entryRows.length} asset(s). Journal: ${journalEntry.entryNumber}`,
    entries: entryRows.length,
    journalEntryNumber: journalEntry.entryNumber,
  };
}

function getAccumDeprAccountId(assetAccountId: string, orgAccounts: any[], accountByCode: Map<string, any>): string | null {
  const assetAcc = orgAccounts.find(a => a.id === assetAccountId);
  if (!assetAcc) return null;
  let accDeprCode = assetAcc.code.slice(0, -1) + '1' + assetAcc.code.slice(-1);
  const tryCode = assetAcc.code.slice(0, -2) + '01';
  if (accountByCode.has(tryCode)) accDeprCode = tryCode;
  const accDepr = accountByCode.get(accDeprCode);
  return accDepr?.id || null;
}

// ==============================
// DEPRECIATION HISTORY
// ==============================

export async function getDepreciationHistory(orgId: string) {
  const { rows } = await db.execute(sql`
    SELECT de.id, de.asset_id AS "assetId", de.period_date AS "periodDate",
      de.amount, de.journal_entry_id AS "journalEntryId", de.entry_number AS "entryNumber",
      de.created_at AS "createdAt", fa.asset_number AS "assetNumber",
      fa.name AS "assetName", fa.purchase_cost AS "purchaseCost",
      fa.accumulated_depreciation AS "accumulatedDepreciation",
      fa.book_value AS "bookValue",
      je.entry_number AS "jeNumber", je.date AS "jeDate"
    FROM depreciation_entries de
    JOIN fixed_assets fa ON fa.id = de.asset_id
    JOIN journal_entries je ON je.id = de.journal_entry_id
    WHERE fa.org_id = ${orgId}
    ORDER BY de.period_date DESC, fa.name ASC
  `);
  return rows || [];
}

// ==============================
// REVALUATION / IMPAIRMENT / MAINTENANCE HISTORY
// ==============================

export async function getRevaluationHistory(orgId: string, assetId?: string) {
  const conditions = [eq(revaluationEntries.orgId, orgId)];
  if (assetId) conditions.push(eq(revaluationEntries.assetId, assetId));
  return db.select().from(revaluationEntries).where(and(...conditions)).orderBy(desc(revaluationEntries.revaluationDate));
}

export async function getImpairmentHistory(orgId: string, assetId?: string) {
  const conditions = [eq(impairmentEntries.orgId, orgId)];
  if (assetId) conditions.push(eq(impairmentEntries.assetId, assetId));
  return db.select().from(impairmentEntries).where(and(...conditions)).orderBy(desc(impairmentEntries.impairmentDate));
}

// ==============================
// IFRS ASSET REPORTS
// ==============================

export async function getFixedAssetRegister(orgId: string) {
  const assets = await db.select().from(fixedAssets).where(eq(fixedAssets.orgId, orgId)).orderBy(asc(fixedAssets.name));
  return assets.map(a => ({
    ...a,
    netBookValue: a.bookValue,
    depreciationToDate: a.accumulatedDepreciation,
    cost: a.purchaseCost,
  }));
}

export async function getAssetSummary(orgId: string) {
  const result = await db.execute(sql`
    SELECT
      count(*)::int AS total_assets,
      count(*) FILTER (WHERE status = 'active')::int AS active_assets,
      count(*) FILTER (WHERE status = 'cwip')::int AS cwip_assets,
      count(*) FILTER (WHERE status = 'disposed')::int AS disposed_assets,
      count(*) FILTER (WHERE status = 'fully_depreciated')::int AS fully_depreciated,
      coalesce(sum(purchase_cost), 0)::bigint AS total_cost,
      coalesce(sum(accumulated_depreciation), 0)::bigint AS total_depreciation,
      coalesce(sum(book_value), 0)::bigint AS total_book_value,
      coalesce(sum(revaluation_amount), 0)::bigint AS total_revaluation,
      coalesce(sum(impairment_loss), 0)::bigint AS total_impairment
    FROM fixed_assets WHERE org_id = ${orgId}
  `);
  return result.rows?.[0] || {};
}

export async function getAssetAging(orgId: string) {
  const { rows } = await db.execute(sql`
    SELECT
      CASE
        WHEN useful_life_months <= 12 THEN '0-1 year'
        WHEN useful_life_months <= 36 THEN '1-3 years'
        WHEN useful_life_months <= 60 THEN '3-5 years'
        WHEN useful_life_months <= 120 THEN '5-10 years'
        ELSE '10+ years'
      END AS age_group,
      count(*)::int AS count,
      coalesce(sum(purchase_cost), 0)::bigint AS total_cost,
      coalesce(sum(accumulated_depreciation), 0)::bigint AS total_depreciation,
      coalesce(sum(book_value), 0)::bigint AS total_book_value
    FROM fixed_assets
    WHERE org_id = ${orgId} AND status NOT IN ('disposed')
    GROUP BY age_group
    ORDER BY min(useful_life_months)
  `);
  return rows || [];
}

export async function getAssetMovementSchedule(orgId: string, fromDate: string, toDate: string) {
  const { rows } = await db.execute(sql`
    SELECT
      a.id, a.asset_number AS "assetNumber", a.name,
      a.status, a.book_value AS "bookValue",
      a.purchase_cost AS "purchaseCost",
      a.accumulated_depreciation AS "accumulatedDepreciation",
      a.purchase_date AS "purchaseDate",
      a.disposal_date AS "disposalDate", a.disposal_amount AS "disposalAmount",
      a.capitalization_date AS "capitalizationDate"
    FROM fixed_assets a
    WHERE a.org_id = ${orgId}
      AND (
        (a.purchase_date >= ${fromDate}::timestamp AND a.purchase_date <= ${toDate}::timestamp)
        OR (a.disposal_date >= ${fromDate}::timestamp AND a.disposal_date <= ${toDate}::timestamp)
        OR (a.capitalization_date >= ${fromDate}::timestamp AND a.capitalization_date <= ${toDate}::timestamp)
      )
    ORDER BY a.name
  `);
  return rows || [];
}
