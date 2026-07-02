import { Router, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, organisations } from '../db/schema';
import { DEVELOPER_ORG_ID } from '../config';

const router = Router();

router.get('/branding', async (_req, res: Response, next: NextFunction) => {
  try {
    if (!DEVELOPER_ORG_ID || DEVELOPER_ORG_ID === 'your-org-id-here') {
      return res.status(200).json({ developerLogoUrl: null });
    }
    const [org] = await db
      .select({ logoUrl: organisations.logoUrl })
      .from(organisations)
      .where(eq(organisations.id, DEVELOPER_ORG_ID))
      .limit(1);
    return res.status(200).json({ developerLogoUrl: org?.logoUrl || null });
  } catch (error) {
    return next(error);
  }
});

export default router;
