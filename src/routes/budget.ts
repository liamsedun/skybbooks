import { Router, Response } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ok } from '../lib/response';
import { getBudgets, getBudget, createBudget, getForecasts, generateForecast } from '../services/budget.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const fiscalYear = req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined;
  const data = await getBudgets(req.user!.orgId!, fiscalYear);
  res.json(ok(data));
}));

router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getBudget(req.params.id, req.user!.orgId!);
  res.json(ok(data));
}));

router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await createBudget(req.user!.orgId!, { ...req.body, createdBy: req.user!.userId! });
  res.status(201).json(ok(data));
}));

router.get('/forecasts/:fiscalYear', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await getForecasts(req.user!.orgId!, Number(req.params.fiscalYear));
  res.json(ok(data));
}));

router.post('/forecasts/generate/:fiscalYear', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await generateForecast(req.user!.orgId!, Number(req.params.fiscalYear));
  res.json(ok(data));
}));

export default router;
