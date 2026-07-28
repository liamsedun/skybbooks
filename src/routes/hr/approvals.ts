import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  getApprovalConfigs, getApprovalConfig, createApprovalConfig, updateApprovalConfig, deleteApprovalConfig,
  getApprovalRequests, getApprovalRequest, createApprovalRequest, cancelApprovalRequest,
  approveStep, rejectStep, sendBackStep, escalateRequest, delegateStep,
  getMyApprovalQueue, getApprovalSteps, getApprovalComments, addApprovalComment,
  getDelegations, createDelegation, deleteDelegation,
  getEscalationRules, createEscalationRule, deleteEscalationRule,
  checkEscalations, getApprovalHistory, getApprovalDashboard,
} from '../../services/hr/approval.service';

const router = Router();

function asUser(req: Request) { return req.user?.employeeId || req.user?.id || 'system'; }
function orgId(req: Request) { return req.user?.orgId || req.user?.organisationId; }

// ── Configs ──
router.get('/configs', authenticate, async (req, res) => {
  const rows = await getApprovalConfigs(orgId(req));
  res.json({ success: true, data: rows });
});

router.get('/configs/:id', authenticate, async (req, res) => {
  const row = await getApprovalConfig(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

router.post('/configs', authenticate, async (req, res) => {
  const row = await createApprovalConfig(orgId(req), { ...req.body, userId: asUser(req) });
  res.json({ success: true, data: row });
});

router.put('/configs/:id', authenticate, async (req, res) => {
  const row = await updateApprovalConfig(orgId(req), req.params.id, { ...req.body, userId: asUser(req) });
  res.json({ success: true, data: row });
});

router.delete('/configs/:id', authenticate, async (req, res) => {
  const row = await deleteApprovalConfig(orgId(req), req.params.id, asUser(req));
  res.json({ success: true, data: row });
});

// ── Requests ──
router.get('/requests', authenticate, async (req, res) => {
  const rows = await getApprovalRequests(orgId(req), req.query as any);
  res.json({ success: true, data: rows });
});

router.get('/requests/:id', authenticate, async (req, res) => {
  const row = await getApprovalRequest(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

router.post('/requests', authenticate, async (req, res) => {
  const row = await createApprovalRequest(orgId(req), { ...req.body, userId: asUser(req) });
  res.json({ success: true, data: row });
});

router.patch('/requests/:id/cancel', authenticate, async (req, res) => {
  const row = await cancelApprovalRequest(orgId(req), req.params.id, asUser(req));
  res.json({ success: true, data: row });
});

// ── Steps ──
router.get('/requests/:id/steps', authenticate, async (req, res) => {
  const rows = await getApprovalSteps(orgId(req), req.params.id);
  res.json({ success: true, data: rows });
});

// ── Approve / Reject / Send Back ──
router.post('/requests/:id/approve', authenticate, async (req, res) => {
  const row = await approveStep(orgId(req), req.params.id, asUser(req), req.body.comment);
  res.json({ success: true, data: row });
});

router.post('/requests/:id/reject', authenticate, async (req, res) => {
  const row = await rejectStep(orgId(req), req.params.id, asUser(req), req.body.comment);
  res.json({ success: true, data: row });
});

router.post('/requests/:id/send-back', authenticate, async (req, res) => {
  const row = await sendBackStep(orgId(req), req.params.id, asUser(req), req.body.comment);
  res.json({ success: true, data: row });
});

router.post('/requests/:id/escalate', authenticate, async (req, res) => {
  const row = await escalateRequest(orgId(req), req.params.id, req.body.escalateToUserId, asUser(req), req.body.comment);
  res.json({ success: true, data: row });
});

router.post('/requests/:id/delegate', authenticate, async (req, res) => {
  const row = await delegateStep(orgId(req), req.params.id, req.body.delegateToUserId, asUser(req));
  res.json({ success: true, data: row });
});

// ── Comments ──
router.get('/requests/:id/comments', authenticate, async (req, res) => {
  const rows = await getApprovalComments(orgId(req), req.params.id);
  res.json({ success: true, data: rows });
});

router.post('/requests/:id/comments', authenticate, async (req, res) => {
  const row = await addApprovalComment(orgId(req), req.params.id, asUser(req), req.body.comment, req.body.stepInstanceId);
  res.json({ success: true, data: row });
});

// ── My Queue ──
router.get('/my-queue', authenticate, async (req, res) => {
  const employeeId = req.user?.employeeId || req.user?.id;
  const rows = await getMyApprovalQueue(orgId(req), employeeId, req.query as any);
  res.json({ success: true, data: rows });
});

// ── Delegations ──
router.get('/delegations', authenticate, async (req, res) => {
  const rows = await getDelegations(orgId(req), req.query.employeeId as string);
  res.json({ success: true, data: rows });
});

router.post('/delegations', authenticate, async (req, res) => {
  const row = await createDelegation(orgId(req), req.body);
  res.json({ success: true, data: row });
});

router.delete('/delegations/:id', authenticate, async (req, res) => {
  const row = await deleteDelegation(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

// ── Escalation Rules ──
router.get('/escalation-rules', authenticate, async (req, res) => {
  const rows = await getEscalationRules(orgId(req), req.query.module as string);
  res.json({ success: true, data: rows });
});

router.post('/escalation-rules', authenticate, async (req, res) => {
  const row = await createEscalationRule(orgId(req), req.body);
  res.json({ success: true, data: row });
});

router.delete('/escalation-rules/:id', authenticate, async (req, res) => {
  const row = await deleteEscalationRule(orgId(req), req.params.id);
  res.json({ success: true, data: row });
});

// ── Check Escalations ──
router.post('/check-escalations', authenticate, async (req, res) => {
  const rows = await checkEscalations(orgId(req));
  res.json({ success: true, data: rows });
});

// ── History ──
router.get('/history', authenticate, async (req, res) => {
  const rows = await getApprovalHistory(orgId(req), req.query as any);
  res.json({ success: true, data: rows });
});

// ── Dashboard ──
router.get('/dashboard', authenticate, async (req, res) => {
  const employeeId = req.user?.employeeId || req.user?.id;
  const stats = await getApprovalDashboard(orgId(req), employeeId);
  res.json({ success: true, data: stats });
});

export default router;
