import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getJobOpenings, getJobOpening, createJobOpening, updateJobOpening, deleteJobOpening,
  publishJobOpening, closeJobOpening,
  getCandidates, getCandidate, createCandidate, updateCandidate, deleteCandidate,
  getApplications, createApplication, updateApplicationStatus, scheduleInterview, sendOffer,
  getOnboardingTasks, createOnboardingTask, completeOnboardingTask, getOnboardingProgress,
  getRecruitmentDashboard,
} from '../../services/hr/recruitment.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Job Openings ──

router.get('/job-openings', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getJobOpenings(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/job-openings/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getJobOpening(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/job-openings', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createJobOpening(orgId, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/job-openings/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateJobOpening(orgId, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/job-openings/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteJobOpening(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/job-openings/:id/publish', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await publishJobOpening(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/job-openings/:id/close', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await closeJobOpening(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Candidates ──

router.get('/candidates', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getCandidates(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/candidates/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getCandidate(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/candidates', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createCandidate(orgId, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.put('/candidates/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateCandidate(orgId, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.delete('/candidates/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteCandidate(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Applications ──

router.get('/applications', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getApplications(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.post('/applications', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createApplication(orgId, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.patch('/applications/:id/status', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateApplicationStatus(orgId, req.params.id, req.body.status, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.post('/applications/:id/interview', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await scheduleInterview(orgId, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.post('/applications/:id/offer', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await sendOffer(orgId, req.params.id, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

// ── Onboarding ──

router.get('/onboarding/:employeeId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const tasks = await getOnboardingTasks(orgId, req.params.employeeId);
  const progress = await getOnboardingProgress(orgId, req.params.employeeId);
  res.json({ success: true, data: { tasks, progress } });
}));

router.post('/onboarding/tasks', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createOnboardingTask(orgId, { ...req.body, userId: req.user!.id });
  res.json({ success: true, data: result });
}));

router.patch('/onboarding/tasks/:id/complete', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await completeOnboardingTask(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Recruitment Dashboard ──

router.get('/recruitment/dashboard', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getRecruitmentDashboard(orgId);
  res.json({ success: true, data: result });
}));

export default router;
