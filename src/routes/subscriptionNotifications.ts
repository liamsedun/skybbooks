import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, subNotificationTemplates } from '../db/schema';
import { AppError } from '../lib/errors';
import {
  triggerNotification, getNotificationLog, getTemplates, createTemplate,
  updateTemplate, deleteTemplate, getPreferences, upsertPreferences,
  processScheduledNotifications,
} from '../services/subscriptionNotifications.service';

const router = Router();

function resolveTargetOrgId(req: Request, bodyOrgId: string | undefined): string {
  if ((req as any).user!.role === 'super_admin') {
    if (!bodyOrgId) throw new AppError('orgId is required for super admin', 400);
    return bodyOrgId;
  }
  return (req as any).user!.orgId || '';
}

router.post('/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, eventType, data } = req.body;
    const targetOrgId = resolveTargetOrgId(req, orgId);
    if (!eventType) {
      return res.status(400).json({ success: false, error: 'eventType is required' });
    }
    const result = await triggerNotification(targetOrgId, eventType, data || {});
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryOrgId = req.query.orgId as string | undefined;
    const targetOrgId: string | undefined = (req as any).user!.role === 'super_admin' ? queryOrgId : ((req as any).user!.orgId || undefined);
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const data = await getNotificationLog(targetOrgId, limit, offset);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryOrgId = req.query.orgId as string | undefined;
    const targetOrgId: string | undefined = (req as any).user!.role === 'super_admin' ? queryOrgId : ((req as any).user!.orgId || undefined);
    const data = await getTemplates(targetOrgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodyOrgId = req.body.orgId;
    const targetOrgId = resolveTargetOrgId(req, bodyOrgId);
    const data = await createTemplate({ ...req.body, orgId: targetOrgId });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [existing] = await db.select({ orgId: subNotificationTemplates.orgId }).from(subNotificationTemplates).where(eq(subNotificationTemplates.id, req.params.id)).limit(1);
    if (!existing) return res.status(404).json({ success: false, error: 'Template not found' });
    if ((req as any).user!.role !== 'super_admin' && existing.orgId !== (req as any).user!.orgId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const data = await updateTemplate(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [existing] = await db.select({ orgId: subNotificationTemplates.orgId }).from(subNotificationTemplates).where(eq(subNotificationTemplates.id, req.params.id)).limit(1);
    if (!existing) return res.status(404).json({ success: false, error: 'Template not found' });
    if ((req as any).user!.role !== 'super_admin' && existing.orgId !== (req as any).user!.orgId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    await deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req.query.orgId || (req as any).user?.orgId) as string;
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId required' });
    const data = await getPreferences(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req.body.orgId || (req as any).user?.orgId) as string;
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId required' });
    const data = await upsertPreferences(orgId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/process-scheduled', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const processed = await processScheduledNotifications();
    res.json({ success: true, data: { processed } });
  } catch (err) { next(err); }
});

export default router;
