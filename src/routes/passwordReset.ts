import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, users, passwordResetTokens } from '../db/schema';
import { AppError } from '../lib/errors';
import { sendOrgEmail } from '../services/email.service';

const router = Router();

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

router.post('/forgot-password', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user || !user.organisationId) {
      return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;

    await sendOrgEmail(user.organisationId, {
      to: user.email,
      subject: 'Reset your SkyBooks password',
      html: `<p>Hello ${user.fullName || 'there'},</p>
<p>Click the link below to reset your password. This link expires in 1 hour:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you didn't request this, please ignore this email.</p>`,
    });

    return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

router.post('/reset-password', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!record || record.usedAt) {
      throw new AppError('Invalid or expired reset token.', 400);
    }

    if (record.expiresAt < new Date()) {
      throw new AppError('Reset token has expired. Please request a new one.', 400);
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, record.userId));
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, record.id));
    });

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(error.issues[0]?.message || 'Validation failed', 400));
    }
    return next(error);
  }
});

export default router;
