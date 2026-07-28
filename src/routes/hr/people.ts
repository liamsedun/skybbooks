import { Router } from 'express';
import { authenticate, requireOrg, AuthenticatedRequest } from '../../middleware/auth';
import { requireTenantPermission } from '../../middleware/tenantAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  getPerformanceReviews, getPerformanceReview, createPerformanceReview,
  updatePerformanceReview, submitPerformanceReview, completePerformanceReview,
  deletePerformanceReview,
  getCourses, getCourse, createCourse, updateCourse, deleteCourse, publishCourse,
  getEnrollments, createEnrollment, updateEnrollmentProgress, completeEnrollment,
  deleteEnrollment,
  getPulseSurveys, getPulseSurvey, createPulseSurvey, updatePulseSurvey,
  launchSurvey, closeSurvey, deletePulseSurvey, submitSurveyResponse,
  getSurveyResults,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getRecognition, createRecognition, deleteRecognition,
  getGoalCycles, createGoalCycle, updateGoalCycle,
  getOkrs, getOkr, createOkr, updateOkr, deleteOkr,
  getKeyResults, createKeyResult, updateKeyResult, deleteKeyResult,
  updateKeyResultProgress, recalculateOkrProgress,
  getPeopleDashboard,
  getKpis, getKpi, createKpi, updateKpi, deleteKpi,
  getPerformanceCycles, getPerformanceCycle, createPerformanceCycle, updatePerformanceCycle, deletePerformanceCycle,
  getReviewSections, createReviewSection, updateReviewSection, deleteReviewSection,
  getDevelopmentPlans, getDevelopmentPlan, createDevelopmentPlan, updateDevelopmentPlan, deleteDevelopmentPlan,
  getPromotionRecommendations, getPromotionRecommendation, createPromotionRecommendation, updatePromotionRecommendation,
  approvePromotionRecommendation, rejectPromotionRecommendation, deletePromotionRecommendation,
  getApprovalConfigs, createApprovalConfig, updateApprovalConfig, deleteApprovalConfig,
  getApprovalRequests, createApprovalRequest, approveApprovalRequest, rejectApprovalRequest,
  getPerformanceAnalytics,
} from '../../services/hr/people.service';

const router = Router();
router.use(authenticate);
router.use(requireOrg);

// ── Performance Reviews ──

router.get('/performance-reviews', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPerformanceReviews(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/performance-reviews/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPerformanceReview(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/performance-reviews', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createPerformanceReview(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/performance-reviews/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updatePerformanceReview(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/performance-reviews/:id/submit', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await submitPerformanceReview(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/performance-reviews/:id/complete', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await completePerformanceReview(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/performance-reviews/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deletePerformanceReview(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── LMS Courses ──

router.get('/courses', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getCourses(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/courses/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getCourse(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/courses', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createCourse(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/courses/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateCourse(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/courses/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteCourse(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/courses/:id/publish', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await publishCourse(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Enrollments ──

router.get('/enrollments', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getEnrollments(orgId, req.query.courseId as string, req.query.employeeId as string);
  res.json({ success: true, data: result });
}));

router.post('/enrollments', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createEnrollment(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/enrollments/:id/progress', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateEnrollmentProgress(orgId, req.params.id, req.body.progress);
  res.json({ success: true, data: result });
}));

router.patch('/enrollments/:id/complete', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await completeEnrollment(orgId, req.params.id, req.body.score);
  res.json({ success: true, data: result });
}));

router.delete('/enrollments/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteEnrollment(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Pulse Surveys ──

router.get('/surveys', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPulseSurveys(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/surveys/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPulseSurvey(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/surveys', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createPulseSurvey(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/surveys/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updatePulseSurvey(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.patch('/surveys/:id/launch', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await launchSurvey(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/surveys/:id/close', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await closeSurvey(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.delete('/surveys/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deletePulseSurvey(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.get('/surveys/:id/results', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getSurveyResults(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/surveys/:id/respond', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await submitSurveyResponse(orgId, req.params.id, req.body.employeeId, req.body.responses);
  res.json({ success: true, data: result });
}));

// ── Announcements ──

router.get('/announcements', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getAnnouncements(orgId);
  res.json({ success: true, data: result });
}));

router.post('/announcements', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createAnnouncement(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/announcements/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateAnnouncement(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/announcements/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteAnnouncement(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Recognition ──

router.get('/recognition', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getRecognition(orgId, req.query.employeeId as string);
  res.json({ success: true, data: result });
}));

router.post('/recognition', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createRecognition(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/recognition/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteRecognition(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Goal Cycles ──

router.get('/goal-cycles', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getGoalCycles(orgId);
  res.json({ success: true, data: result });
}));

router.post('/goal-cycles', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createGoalCycle(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/goal-cycles/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateGoalCycle(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

// ── OKRs ──

router.get('/okrs', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getOkrs(orgId, req.query as any);
  res.json({ success: true, data: result });
}));

router.get('/okrs/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getOkr(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/okrs', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createOkr(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/okrs/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateOkr(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/okrs/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteOkr(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

// ── Key Results ──

router.get('/key-results/:okrId', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getKeyResults(orgId, req.params.okrId);
  res.json({ success: true, data: result });
}));

router.post('/key-results', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await createKeyResult(orgId, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.put('/key-results/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.id;
  const result = await updateKeyResult(orgId, req.params.id, { ...req.body, userId });
  res.json({ success: true, data: result });
}));

router.delete('/key-results/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await deleteKeyResult(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.patch('/key-results/:id/progress', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateKeyResultProgress(orgId, req.params.id, req.body.currentValue);
  res.json({ success: true, data: result });
}));

// ── Dashboard ──

router.get('/people/dashboard', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPeopleDashboard(orgId);
  res.json({ success: true, data: result });
}));

// ── KPIs ──

router.get('/kpis', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { employeeId } = req.query as any;
  const result = await getKpis(orgId, employeeId);
  res.json({ success: true, data: result });
}));

router.get('/kpis/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getKpi(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/kpis', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createKpi(orgId, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.put('/kpis/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateKpi(orgId, req.params.id, req.body);
  res.json({ success: true, data: result });
}));

router.delete('/kpis/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  await deleteKpi(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Performance Cycles ──

router.get('/performance-cycles', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPerformanceCycles(orgId);
  res.json({ success: true, data: result });
}));

router.get('/performance-cycles/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPerformanceCycle(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/performance-cycles', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createPerformanceCycle(orgId, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.put('/performance-cycles/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updatePerformanceCycle(orgId, req.params.id, req.body);
  res.json({ success: true, data: result });
}));

router.delete('/performance-cycles/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  await deletePerformanceCycle(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Review Sections ──

router.get('/performance-reviews/:reviewId/sections', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getReviewSections(orgId, req.params.reviewId);
  res.json({ success: true, data: result });
}));

router.post('/performance-reviews/:reviewId/sections', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createReviewSection(orgId, { ...req.body, reviewId: req.params.reviewId });
  res.status(201).json({ success: true, data: result });
}));

router.put('/review-sections/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateReviewSection(orgId, req.params.id, req.body);
  res.json({ success: true, data: result });
}));

router.delete('/review-sections/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  await deleteReviewSection(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Development Plans ──

router.get('/development-plans', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { employeeId } = req.query as any;
  const result = await getDevelopmentPlans(orgId, employeeId);
  res.json({ success: true, data: result });
}));

router.get('/development-plans/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getDevelopmentPlan(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/development-plans', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createDevelopmentPlan(orgId, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.put('/development-plans/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateDevelopmentPlan(orgId, req.params.id, req.body);
  res.json({ success: true, data: result });
}));

router.delete('/development-plans/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  await deleteDevelopmentPlan(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Promotion Recommendations ──

router.get('/promotions', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { status } = req.query as any;
  const result = await getPromotionRecommendations(orgId, status);
  res.json({ success: true, data: result });
}));

router.get('/promotions/:id', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getPromotionRecommendation(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.post('/promotions', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createPromotionRecommendation(orgId, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.put('/promotions/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updatePromotionRecommendation(orgId, req.params.id, req.body);
  res.json({ success: true, data: result });
}));

router.patch('/promotions/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const userId = req.user!.userId;
  const result = await approvePromotionRecommendation(orgId, req.params.id, userId);
  res.json({ success: true, data: result });
}));

router.patch('/promotions/:id/reject', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await rejectPromotionRecommendation(orgId, req.params.id);
  res.json({ success: true, data: result });
}));

router.delete('/promotions/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  await deletePromotionRecommendation(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

// ── Approval Configs & Requests ──

router.get('/approval-configs', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await getApprovalConfigs(orgId);
  res.json({ success: true, data: result });
}));

router.post('/approval-configs', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createApprovalConfig(orgId, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.put('/approval-configs/:id', requireTenantPermission('hr:update'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await updateApprovalConfig(orgId, req.params.id, req.body);
  res.json({ success: true, data: result });
}));

router.delete('/approval-configs/:id', requireTenantPermission('hr:delete'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  await deleteApprovalConfig(orgId, req.params.id);
  res.json({ success: true, data: null });
}));

router.get('/approval-requests', requireTenantPermission('hr:read'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { module, status } = req.query as any;
  const result = await getApprovalRequests(orgId, module, status);
  res.json({ success: true, data: result });
}));

router.post('/approval-requests', requireTenantPermission('hr:create'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await createApprovalRequest(orgId, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.patch('/approval-requests/:id/approve', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await approveApprovalRequest(orgId, req.params.id, req.body.comment);
  res.json({ success: true, data: result });
}));

router.patch('/approval-requests/:id/reject', requireTenantPermission('hr:approve'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const result = await rejectApprovalRequest(orgId, req.params.id, req.body.comment);
  res.json({ success: true, data: result });
}));

// ── Performance Analytics ──

router.get('/performance/analytics', requireTenantPermission('hr:reports'), asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const orgId = req.user!.orgId!;
  const { dateFrom, dateTo } = req.query as any;
  const result = await getPerformanceAnalytics(orgId, dateFrom, dateTo);
  res.json({ success: true, data: result });
}));

export default router;
