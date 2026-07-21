import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getSerials, registerSerial, transferSerial, getBatches, createBatch, consumeBatch } from '../services/inventoryTracking.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

router.get('/serials', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getSerials(req.user!.orgId!, req.query.itemId as string);
  res.json(ok(data));
}));

router.post('/serials', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await registerSerial(req.user!.orgId!, req.body);
  res.status(201).json(ok(data));
}));

router.put('/serials/:id/transfer', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, soldTo } = req.body;
  const data = await transferSerial(req.params.id, req.user!.orgId!, status, soldTo);
  res.json(ok(data));
}));

router.get('/batches', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getBatches(req.user!.orgId!, req.query.itemId as string);
  res.json(ok(data));
}));

router.post('/batches', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await createBatch(req.user!.orgId!, req.body);
  res.status(201).json(ok(data));
}));

router.post('/batches/:id/consume', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { quantity } = z.object({ quantity: z.number().min(1) }).parse(req.body);
  const data = await consumeBatch(req.params.id, req.user!.orgId!, quantity);
  res.json(ok(data));
}));

export default router;
