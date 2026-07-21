import { Router, Response, NextFunction } from 'express';
import { authenticate, requireRole, resolveSuperAdmin, AuthenticatedRequest } from '../middleware/auth';
import {
  triggerNotification, getNotificationLog, getTemplates, createTemplate,
  updateTemplate, deleteTemplate, getPreferences, upsertPreferences,
  processScheduledNotifications,
} from '../services/subscriptionNotifications.service';

const router = Router();
router.use(authenticate);
router.use(resolveSuperAdmin);
router.use(requireRole('super_admin', 'owner', 'admin'));

router.post('/trigger', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, eventType, data } = req.body;
    if (!orgId || !eventType) {
      return res.status(400).json({ success: false, error: 'orgId and eventType are required' });
    }
    const result = await triggerNotification(orgId, eventType, data || {});
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/log', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const data = await getNotificationLog(orgId, limit, offset);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.get('/templates', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const data = await getTemplates(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/templates', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await createTemplate(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/templates/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await updateTemplate(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/templates/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/preferences', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = (req.query.orgId || req.user?.orgId) as string;
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId required' });
    const data = await getPreferences(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/preferences', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = (req.body.orgId || req.user?.orgId) as string;
    if (!orgId) return res.status(400).json({ success: false, error: 'orgId required' });
    const data = await upsertPreferences(orgId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/process-scheduled', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const processed = await processScheduledNotifications();
    res.json({ success: true, data: { processed } });
  } catch (err) { next(err); }
});

export default router;
