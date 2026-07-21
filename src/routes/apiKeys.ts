import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/apiKey.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const keys = await listApiKeys(req.user!.orgId!);
  res.json(ok(keys));
}));

router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, scopes, expiresAt } = z.object({
    name: z.string().min(1),
    scopes: z.array(z.string()).default(['read']),
    expiresAt: z.string().optional(),
  }).parse(req.body);
  const key = await createApiKey(req.user!.orgId!, name, scopes, expiresAt);
  res.status(201).json(ok(key));
}));

router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await revokeApiKey(req.params.id, req.user!.orgId!);
  res.json(ok(result));
}));

export default router;
