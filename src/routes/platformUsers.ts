import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, like, or, sql, desc } from 'drizzle-orm';
import { db, platformUsers } from '../db/schema';
import { AppError } from '../lib/errors';
import { platformAuthenticate, platformUserGuard, requirePlatformPermission } from '../middleware/platformAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok, paginated } from '../lib/response';
import { sendPlatformEmail } from '../services/email.service';

const router = Router();
router.use(platformAuthenticate);
router.use(platformUserGuard);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Name is required'),
  role: z.enum(['super_admin', 'admin', 'billing_manager', 'support_manager', 'analyst', 'developer', 'security_auditor', 'marketing_manager', 'onboarding_specialist', 'compliance_officer', 'viewer'] as const),
  isActive: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(['super_admin', 'admin', 'billing_manager', 'support_manager', 'analyst', 'developer', 'security_auditor', 'marketing_manager', 'onboarding_specialist', 'compliance_officer', 'viewer'] as const).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', requirePlatformPermission('users:read'), asyncHandler(async (req: any, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
  const search = (req.query.search || '') as string;
  const role = req.query.role as string | undefined;

  let conditions = [];
  if (search) {
    conditions.push(or(
      like(platformUsers.email, `%${search}%`),
      like(platformUsers.fullName, `%${search}%`),
    ));
  }
  if (role) conditions.push(eq(platformUsers.role, role as any));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const total = await db.select({ count: sql<number>`count(*)` }).from(platformUsers).where(where).then(r => Number(r[0].count));
  const data = await db.select()
    .from(platformUsers)
    .where(where)
    .orderBy(desc(platformUsers.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const safe = data.map(({ passwordHash: _, ...u }) => u);
  res.json(paginated(safe, total, page, pageSize));
}));

router.post('/', requirePlatformPermission('users:create'), asyncHandler(async (req: any, res: Response) => {
  const body = createSchema.parse(req.body);
  const email = body.email.toLowerCase();

  const existing = await db.select({ id: platformUsers.id }).from(platformUsers).where(eq(platformUsers.email, email)).limit(1);
  if (existing.length > 0) throw new AppError('A user with this email already exists.', 409);

  const hash = await bcrypt.hash(body.password, 12);
  const [user] = await db.insert(platformUsers).values({
    email,
    passwordHash: hash,
    fullName: body.fullName,
    role: body.role as any,
    isActive: body.isActive,
  }).returning();

  sendPlatformEmail({
    to: email,
    subject: 'Your SkyBooks Platform Account',
    html: `<p>Hello ${body.fullName},</p>
<p>A SkyBooks platform administrator account has been created for you.</p>
<p><strong>Email:</strong> ${email}<br/>
<strong>Password:</strong> (the password set by your administrator)</p>
<p>You can log in at the <a href="${process.env.FRONTEND_URL || 'https://skybooks-api-ik5m.onrender.com'}/platform/login">Platform Login</a> page.</p>
<p>If you did not expect this email, please contact your administrator.</p>`,
    fromName: 'SkyBooks',
  }).catch(err => console.error('[PlatformUsers] Welcome email failed:', err));

  const { passwordHash: _, ...safe } = user;
  res.status(201).json(ok(safe));
}));

router.put('/:id', requirePlatformPermission('users:update'), asyncHandler(async (req: any, res: Response) => {
  const body = updateSchema.parse(req.body);
  const { id } = req.params;

  const existing = await db.select({ id: platformUsers.id }).from(platformUsers).where(eq(platformUsers.id, id)).limit(1);
  if (existing.length === 0) throw new AppError('Platform user not found.', 404);

  await db.update(platformUsers).set({ ...body, updatedAt: new Date() }).where(eq(platformUsers.id, id));

  const [updated] = await db.select().from(platformUsers).where(eq(platformUsers.id, id)).limit(1);
  const { passwordHash: _, ...safe } = updated;
  res.json(ok(safe));
}));

router.put('/:id/password', requirePlatformPermission('users:update'), asyncHandler(async (req: any, res: Response) => {
  const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
  const { id } = req.params;

  const existing = await db.select({ id: platformUsers.id }).from(platformUsers).where(eq(platformUsers.id, id)).limit(1);
  if (existing.length === 0) throw new AppError('Platform user not found.', 404);

  const hash = await bcrypt.hash(password, 12);
  await db.update(platformUsers).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(platformUsers.id, id));
  res.json(ok({ message: 'Password updated successfully.' }));
}));

router.delete('/:id', requirePlatformPermission('users:delete'), asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  const existing = await db.select({ id: platformUsers.id, role: platformUsers.role }).from(platformUsers).where(eq(platformUsers.id, id)).limit(1);
  if (existing.length === 0) throw new AppError('Platform user not found.', 404);
  if (existing[0].role === 'super_admin') throw new AppError('Cannot delete a super_admin user.', 403);

  await db.delete(platformUsers).where(eq(platformUsers.id, id));
  res.json(ok({ message: 'Platform user deleted.' }));
}));

function and(...conditions: any[]) {
  return conditions.length > 0 ? conditions.reduce((a, b) => sql`${a} and ${b}`) : undefined;
}

export default router;
