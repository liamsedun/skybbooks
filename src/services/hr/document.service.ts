import { sql, eq, and, or, like, desc, asc, count, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrDocCategories, hrDocFiles, hrDocVersions, hrDocPermissions, hrDocEmployeeLinks, hrEmployees
} from '../../db/schema';
import { createAuditLog } from '../audit.service';

// ── Categories ──

export async function getDocCategories(orgId: string) {
  return await db.select().from(hrDocCategories).where(eq(hrDocCategories.orgId, orgId)).orderBy(asc(hrDocCategories.sortOrder));
}

export async function getDocCategory(orgId: string, catId: string) {
  const [row] = await db.select().from(hrDocCategories).where(and(eq(hrDocCategories.id, catId), eq(hrDocCategories.orgId, orgId)));
  if (!row) throw new Error('Category not found');
  return row;
}

export async function createDocCategory(orgId: string, data: any) {
  const [row] = await db.insert(hrDocCategories).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'doc_category', entityId: row.id, newValues: data });
  return row;
}

export async function updateDocCategory(orgId: string, catId: string, data: any) {
  const [row] = await db.update(hrDocCategories).set({ ...data, updatedAt: new Date() }).where(and(eq(hrDocCategories.id, catId), eq(hrDocCategories.orgId, orgId))).returning();
  if (!row) throw new Error('Category not found');
  return row;
}

export async function deleteDocCategory(orgId: string, catId: string) {
  await db.update(hrDocFiles).set({ categoryId: null }).where(and(eq(hrDocFiles.categoryId, catId), eq(hrDocFiles.orgId, orgId)));
  await db.delete(hrDocCategories).where(and(eq(hrDocCategories.id, catId), eq(hrDocCategories.orgId, orgId)));
}

// ── Files ──

export async function getDocFiles(orgId: string, filters?: { categoryId?: string; status?: string; search?: string; employeeId?: string; expiryBefore?: string }) {
  const conditions: any[] = [eq(hrDocFiles.orgId, orgId)];
  if (filters?.categoryId) conditions.push(eq(hrDocFiles.categoryId, filters.categoryId));
  if (filters?.status) conditions.push(eq(hrDocFiles.status as any, filters.status));
  if (filters?.search) conditions.push(or(like(hrDocFiles.name, `%${filters.search}%`), sql`${hrDocFiles.tags}::text ILIKE ${'%' + filters.search + '%'}`));
  if (filters?.employeeId) {
    const linkedIds = await db.select({ fileId: hrDocEmployeeLinks.fileId }).from(hrDocEmployeeLinks).where(eq(hrDocEmployeeLinks.employeeId, filters.employeeId));
    conditions.push(inArray(hrDocFiles.id, linkedIds.map(l => l.fileId)));
  }
  if (filters?.expiryBefore) conditions.push(sql`${hrDocFiles.expiryDate} <= ${filters.expiryBefore}::date`);
  return await db.select().from(hrDocFiles).where(and(...conditions)).orderBy(desc(hrDocFiles.createdAt));
}

export async function getDocFile(orgId: string, fileId: string) {
  const [row] = await db.select().from(hrDocFiles).where(and(eq(hrDocFiles.id, fileId), eq(hrDocFiles.orgId, orgId)));
  if (!row) throw new Error('File not found');
  return row;
}

export async function createDocFile(orgId: string, data: any) {
  const [row] = await db.insert(hrDocFiles).values({ orgId, ...data }).returning();
  await createAuditLog({ orgId, userId: data.uploadedBy || 'system', action: 'create', entityType: 'doc_file', entityId: row.id, newValues: data });
  return row;
}

export async function updateDocFile(orgId: string, fileId: string, data: any) {
  const [row] = await db.update(hrDocFiles).set({ ...data, updatedAt: new Date() }).where(and(eq(hrDocFiles.id, fileId), eq(hrDocFiles.orgId, orgId))).returning();
  if (!row) throw new Error('File not found');
  return row;
}

export async function uploadNewVersion(orgId: string, fileId: string, data: any) {
  const existing = await getDocFile(orgId, fileId);
  const newVersion = (existing.version || 1) + 1;
  await db.insert(hrDocVersions).values({ fileId, orgId, versionNumber: existing.version, fileUrl: existing.fileUrl, fileType: existing.fileType, fileSize: existing.fileSize, fileHash: existing.fileHash, changeNotes: data.changeNotes || '', uploadedBy: data.uploadedBy || 'system' });
  const [row] = await db.update(hrDocFiles).set({ fileUrl: data.fileUrl, fileType: data.fileType, fileSize: data.fileSize, fileHash: data.fileHash, version: newVersion, updatedAt: new Date() }).where(and(eq(hrDocFiles.id, fileId), eq(hrDocFiles.orgId, orgId))).returning();
  if (!row) throw new Error('File not found');
  await createAuditLog({ orgId, userId: data.uploadedBy || 'system', action: 'update', entityType: 'doc_file', entityId: row.id, newValues: { version: newVersion } });
  return row;
}

export async function deleteDocFile(orgId: string, fileId: string) {
  await db.delete(hrDocEmployeeLinks).where(and(eq(hrDocEmployeeLinks.fileId, fileId), eq(hrDocEmployeeLinks.orgId, orgId)));
  await db.delete(hrDocPermissions).where(and(eq(hrDocPermissions.fileId, fileId), eq(hrDocPermissions.orgId, orgId)));
  await db.delete(hrDocVersions).where(and(eq(hrDocVersions.fileId, fileId), eq(hrDocVersions.orgId, orgId)));
  await db.delete(hrDocFiles).where(and(eq(hrDocFiles.id, fileId), eq(hrDocFiles.orgId, orgId)));
  await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'doc_file', entityId: fileId });
}

// ── Versions ──

export async function getDocVersions(orgId: string, fileId: string) {
  return await db.select().from(hrDocVersions).where(and(eq(hrDocVersions.fileId, fileId), eq(hrDocVersions.orgId, orgId))).orderBy(desc(hrDocVersions.versionNumber));
}

// ── Permissions ──

export async function getDocPermissions(orgId: string, fileId: string) {
  return await db.select().from(hrDocPermissions).where(and(eq(hrDocPermissions.fileId, fileId), eq(hrDocPermissions.orgId, orgId)));
}

export async function setDocPermission(orgId: string, data: any) {
  const [row] = await db.insert(hrDocPermissions).values({ orgId, ...data }).returning();
  return row;
}

export async function removeDocPermission(orgId: string, permId: string) {
  await db.delete(hrDocPermissions).where(and(eq(hrDocPermissions.id, permId), eq(hrDocPermissions.orgId, orgId)));
}

// ── Employee Links ──

export async function getDocEmployeeLinks(orgId: string, fileId: string) {
  return await db.select().from(hrDocEmployeeLinks).where(and(eq(hrDocEmployeeLinks.fileId, fileId), eq(hrDocEmployeeLinks.orgId, orgId)));
}

export async function linkDocToEmployee(orgId: string, data: any) {
  const [row] = await db.insert(hrDocEmployeeLinks).values({ orgId, ...data }).returning();
  return row;
}

export async function unlinkDocFromEmployee(orgId: string, linkId: string) {
  await db.delete(hrDocEmployeeLinks).where(and(eq(hrDocEmployeeLinks.id, linkId), eq(hrDocEmployeeLinks.orgId, orgId)));
}

// ─── Employee Documents (for employee profile) ──

export async function getEmployeeDocs(orgId: string, employeeId: string) {
  const links = await db.select({
    fileId: hrDocEmployeeLinks.fileId,
    linkType: hrDocEmployeeLinks.linkType,
  }).from(hrDocEmployeeLinks).where(and(eq(hrDocEmployeeLinks.employeeId, employeeId), eq(hrDocEmployeeLinks.orgId, orgId)));
  if (links.length === 0) return [];
  const fileIds = links.map(l => l.fileId);
  const files = await db.select().from(hrDocFiles).where(and(inArray(hrDocFiles.id, fileIds), eq(hrDocFiles.orgId, orgId)));
  return files.map(f => ({ ...f, linkType: links.find(l => l.fileId === f.id)?.linkType }));
}

// ── Document Dashboard ──

export async function getDocDashboard(orgId: string) {
  const totalFiles = await db.select({ count: count() }).from(hrDocFiles).where(eq(hrDocFiles.orgId, orgId)).then(r => r[0]?.count || 0);
  const activeFiles = await db.select({ count: count() }).from(hrDocFiles).where(and(eq(hrDocFiles.orgId, orgId), eq(hrDocFiles.status, 'active'))).then(r => r[0]?.count || 0);
  const expiredFiles = await db.select({ count: count() }).from(hrDocFiles).where(and(eq(hrDocFiles.orgId, orgId), eq(hrDocFiles.status, 'expired'))).then(r => r[0]?.count || 0);
  const totalCategories = await db.select({ count: count() }).from(hrDocCategories).where(and(eq(hrDocCategories.orgId, orgId), eq(hrDocCategories.isActive, true))).then(r => r[0]?.count || 0);
  const totalSize = await db.select({ total: sql`COALESCE(SUM(${hrDocFiles.fileSize}), 0)` }).from(hrDocFiles).where(eq(hrDocFiles.orgId, orgId)).then(r => Number(r[0]?.total || 0));

  return { totalFiles: Number(totalFiles), activeFiles: Number(activeFiles), expiredFiles: Number(expiredFiles), totalCategories: Number(totalCategories), totalSize };
}
