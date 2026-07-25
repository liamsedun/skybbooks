import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, platformUsers } from '../db/schema';
import { AppError } from '../lib/errors';
import { platformAuthenticate, platformUserGuard, PlatformAuthenticatedRequest } from '../middleware/platformAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';

const router = Router();
router.use(platformAuthenticate);
router.use(platformUserGuard);

router.get('/', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const [user] = await db.select({
    id: platformUsers.id,
    email: platformUsers.email,
    fullName: platformUsers.fullName,
    role: platformUsers.role,
    isActive: platformUsers.isActive,
    avatarUrl: platformUsers.avatarUrl,
    preferences: platformUsers.preferences,
    lastLogin: platformUsers.lastLogin,
    createdAt: platformUsers.createdAt,
  }).from(platformUsers).where(eq(platformUsers.id, req.platformUser!.id)).limit(1);
  if (!user) throw new AppError('User not found.', 404);
  res.json(ok(user));
}));

router.put('/', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const { fullName, avatarUrl } = z.object({
    fullName: z.string().min(1).optional(),
    avatarUrl: z.string().optional(),
  }).parse(req.body);
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (fullName !== undefined) updates.fullName = fullName;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  const [user] = await db.update(platformUsers).set(updates as any)
    .where(eq(platformUsers.id, req.platformUser!.id)).returning();
  const { passwordHash: _, ...safe } = user;
  res.json(ok(safe));
}));

router.put('/password', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  }).parse(req.body);

  const [user] = await db.select({ passwordHash: platformUsers.passwordHash })
    .from(platformUsers).where(eq(platformUsers.id, req.platformUser!.id)).limit(1);
  if (!user) throw new AppError('User not found.', 404);

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash || '');
  if (!isMatch) throw new AppError('Current password is incorrect.', 400);

  const hash = await bcrypt.hash(newPassword, 12);
  await db.update(platformUsers).set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(platformUsers.id, req.platformUser!.id));
  res.json(ok({ message: 'Password updated successfully.' }));
}));

router.put('/preferences', asyncHandler(async (req: PlatformAuthenticatedRequest, res: Response) => {
  const { preferences } = z.object({
    preferences: z.record(z.string(), z.any()),
  }).parse(req.body);
  const [user] = await db.update(platformUsers).set({ preferences: preferences as any, updatedAt: new Date() })
    .where(eq(platformUsers.id, req.platformUser!.id)).returning();
  const { passwordHash: _, ...safe } = user;
  res.json(ok(safe));
}));

export default router;
