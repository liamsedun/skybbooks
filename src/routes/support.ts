import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getTickets, getTicket, getAllTickets, createTicket, addTicketMessage, updateTicketStatus } from '../services/support.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getTickets(req.user!.orgId!, req.query.status as string, req.query.priority as string);
  res.json(ok(data));
}));

router.get('/all', requireRole('admin'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getAllTickets(req.query.status as string, req.query.priority as string);
  res.json(ok(data));
}));

router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getTicket(req.params.id);
  res.json(ok(data));
}));

router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { subject, message, category, priority } = z.object({
    subject: z.string().min(1), message: z.string().min(1),
    category: z.string().optional(), priority: z.string().optional(),
  }).parse(req.body);
  const data = await createTicket(req.user!.orgId!, req.user!.userId!, { subject, message, category, priority });
  res.status(201).json(ok(data));
}));

router.post('/:id/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { message, isInternal } = z.object({
    message: z.string().min(1), isInternal: z.boolean().default(false),
  }).parse(req.body);
  const data = await addTicketMessage(req.params.id, req.user!.userId!, message, isInternal);
  res.status(201).json(ok(data));
}));

router.put('/:id/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, resolution, assignedTo } = z.object({
    status: z.string().min(1), resolution: z.string().optional(), assignedTo: z.string().optional(),
  }).parse(req.body);
  const data = await updateTicketStatus(req.params.id, status, resolution, assignedTo);
  res.json(ok(data));
}));

export default router;
