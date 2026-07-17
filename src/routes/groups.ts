import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import * as groupService from '../services/group.service';
import { AppError } from '../lib/errors';
import { createAuditLog, extractReqMeta } from '../services/audit.service';

const router = Router();
router.use(authenticate);

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required.'),
  baseCurrency: z.string().length(3).optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  baseCurrency: z.string().length(3).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const addMemberSchema = z.object({
  orgId: z.string().uuid(),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  consolidationMethod: z.enum(['full', 'equity', 'proportionate']).optional(),
  isParent: z.boolean().optional(),
});

const updateMemberSchema = z.object({
  ownershipPercentage: z.number().min(0).max(100).optional(),
  consolidationMethod: z.enum(['full', 'equity', 'proportionate']).optional(),
  isParent: z.boolean().optional(),
  endDate: z.string().transform(v => new Date(v)).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const groups = await groupService.listGroups(userId);
    return res.status(200).json(groups);
  } catch (error) { return next(error); }
});

router.get('/org-access', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const accessibleOrgs = await groupService.getOrgAccess(userId);
    return res.status(200).json(accessibleOrgs);
  } catch (error) { return next(error); }
});

router.post('/switch-org', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const { orgId } = z.object({ orgId: z.string().uuid() }).parse(req.body);
    const result = await groupService.switchOrg(userId, orgId);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.get('/:groupId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const group = await groupService.getGroup(groupId);
    return res.status(200).json(group);
  } catch (error) { return next(error); }
});

router.post('/', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const body = createGroupSchema.parse(req.body);
    const group = await groupService.createGroup({ name: body.name, baseCurrency: body.baseCurrency }, userId);
    createAuditLog({ orgId: group.id, userId, action: 'create', entityType: 'group', entityId: group.id, newValues: body, ...extractReqMeta(req) });
    return res.status(201).json(group);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.put('/:groupId', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const { groupId } = req.params;
    const body = updateGroupSchema.parse(req.body);
    const group = await groupService.updateGroup(groupId, body);
    createAuditLog({ orgId: groupId, userId, action: 'update', entityType: 'group', entityId: groupId, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(group);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.delete('/:groupId', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const { groupId } = req.params;
    await groupService.deleteGroup(groupId);
    createAuditLog({ orgId: groupId, userId, action: 'delete', entityType: 'group', entityId: groupId, description: `Group deleted`, ...extractReqMeta(req) });
    return res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (error) { return next(error); }
});

router.get('/:groupId/members', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const group = await groupService.getGroup(groupId);
    return res.status(200).json((group as any).members || []);
  } catch (error) { return next(error); }
});

router.post('/:groupId/members', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const { groupId } = req.params;
    const body = addMemberSchema.parse(req.body);
    const member = await groupService.addGroupMember(groupId, body.orgId, body.ownershipPercentage, body.consolidationMethod, body.isParent);
    createAuditLog({ orgId: groupId, userId, action: 'create', entityType: 'group_member', entityId: member.id, newValues: body, ...extractReqMeta(req) });
    return res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.put('/members/:memberId', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const { memberId } = req.params;
    const body = updateMemberSchema.parse(req.body);
    const member = await groupService.updateGroupMember(memberId, body);
    createAuditLog({ orgId: memberId, userId, action: 'update', entityType: 'group_member', entityId: memberId, newValues: body, ...extractReqMeta(req) });
    return res.status(200).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) { return next(new AppError(error.issues[0]?.message || 'Validation failed', 400)); }
    return next(error);
  }
});

router.delete('/members/:memberId', requireRole('owner', 'admin'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId!;
    const { memberId } = req.params;
    await groupService.removeGroupMember(memberId);
    createAuditLog({ orgId: memberId, userId, action: 'delete', entityType: 'group_member', entityId: memberId, description: `Group member removed`, ...extractReqMeta(req) });
    return res.status(200).json({ message: 'Group member removed successfully.' });
  } catch (error) { return next(error); }
});

export default router;
