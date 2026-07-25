import { eq } from 'drizzle-orm';
import { db, platformRolePermissions } from '../db/schema';
import { AppError } from '../lib/errors';

export async function getAllRolePermissions() {
  const rows = await db.select()
    .from(platformRolePermissions)
    .orderBy(platformRolePermissions.role);
  return rows.map(r => ({ role: r.role, permissions: r.permissions as string[] }));
}

export async function getRolePermissions(role: string) {
  const [row] = await db.select()
    .from(platformRolePermissions)
    .where(eq(platformRolePermissions.role, role))
    .limit(1);
  return row ? (row.permissions as string[]) : null;
}

export async function updateRolePermissions(role: string, permissions: string[]) {
  const [row] = await db.update(platformRolePermissions)
    .set({ permissions: permissions as any, updatedAt: new Date() })
    .where(eq(platformRolePermissions.role, role))
    .returning();
  if (!row) throw new AppError(`Role '${role}' not found.`, 404);
  return { role: row.role, permissions: row.permissions as string[] };
}

export async function createRole(role: string, permissions: string[]) {
  const [row] = await db.insert(platformRolePermissions)
    .values({ role, permissions: permissions as any })
    .returning();
  return { role: row.role, permissions: row.permissions as string[] };
}

export async function deleteRole(role: string) {
  const [row] = await db.delete(platformRolePermissions)
    .where(eq(platformRolePermissions.role, role))
    .returning();
  if (!row) throw new AppError(`Role '${role}' not found.`, 404);
  return { deleted: true };
}
