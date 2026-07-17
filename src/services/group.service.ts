/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { and, eq, sql, inArray } from 'drizzle-orm';
import { db, groups, groupMembers, organisations, userOrganisationAccess, users } from '../db/schema';
import { AppError } from '../lib/errors';

export async function listGroups(userId: string) {
  // First get all orgs the user has access to
  const accessRecords = await db
    .select({ orgId: userOrganisationAccess.orgId })
    .from(userOrganisationAccess)
    .where(eq(userOrganisationAccess.userId, userId));

  const user = await db
    .select({ organisationId: users.organisationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const orgIds = new Set<string>();
  for (const r of accessRecords) {
    if (r.orgId) orgIds.add(r.orgId);
  }
  if (user.length > 0 && user[0].organisationId) {
    orgIds.add(user[0].organisationId);
  }

  if (orgIds.size === 0) {
    return [];
  }

  // Find all groups that contain any of the user's orgs
  const memberGroupIds = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(inArray(groupMembers.orgId, Array.from(orgIds)));

  if (memberGroupIds.length === 0) {
    return [];
  }

  const gIds = [...new Set(memberGroupIds.map(m => m.groupId))];

  const result = await db
    .select()
    .from(groups)
    .where(inArray(groups.id, gIds));

  // Attach member counts
  const enriched = await Promise.all(
    result.map(async (g) => {
      const members = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, g.id));
      return { ...g, memberCount: members[0]?.count ?? 0 };
    })
  );

  return enriched;
}

export async function getGroup(groupId: string) {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const members = await db
    .select({
      id: groupMembers.id,
      orgId: groupMembers.orgId,
      orgName: organisations.name,
      orgCurrency: organisations.baseCurrency,
      ownershipPercentage: groupMembers.ownershipPercentage,
      consolidationMethod: groupMembers.consolidationMethod,
      isParent: groupMembers.isParent,
      startDate: groupMembers.startDate,
      endDate: groupMembers.endDate,
      settings: groupMembers.settings,
    })
    .from(groupMembers)
    .leftJoin(organisations, eq(groupMembers.orgId, organisations.id))
    .where(eq(groupMembers.groupId, groupId));

  return { ...group, members };
}

export async function createGroup(
  data: { name: string; baseCurrency?: string },
  userId: string
) {
  const [group] = await db
    .insert(groups)
    .values({
      name: data.name,
      baseCurrency: data.baseCurrency || 'NGN',
      settings: {},
    })
    .returning();

  return group;
}

export async function updateGroup(
  groupId: string,
  data: { name?: string; baseCurrency?: string; settings?: Record<string, any> }
) {
  const [existing] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!existing) {
    throw new AppError('Group not found', 404);
  }

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.baseCurrency !== undefined) updateData.baseCurrency = data.baseCurrency;
  if (data.settings !== undefined) updateData.settings = data.settings;

  const [updated] = await db
    .update(groups)
    .set(updateData)
    .where(eq(groups.id, groupId))
    .returning();

  return updated;
}

export async function deleteGroup(groupId: string) {
  const [existing] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!existing) {
    throw new AppError('Group not found', 404);
  }

  const members = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  if ((members[0]?.count ?? 0) > 0) {
    throw new AppError('Cannot delete group with active members. Remove all members first.', 400);
  }

  await db.delete(groups).where(eq(groups.id, groupId));

  return { success: true };
}

export async function addGroupMember(
  groupId: string,
  orgId: string,
  ownershipPercentage?: number,
  consolidationMethod?: 'full' | 'equity' | 'proportionate',
  isParent?: boolean
) {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) {
    throw new AppError('Organisation not found', 404);
  }

  // Check for duplicate member
  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.orgId, orgId),
    ))
    .limit(1);

  if (existing) {
    throw new AppError('Organisation is already a member of this group', 409);
  }

  const [member] = await db
    .insert(groupMembers)
    .values({
      groupId,
      orgId,
      ownershipPercentage: ownershipPercentage != null ? String(ownershipPercentage) : '100',
      consolidationMethod: consolidationMethod || 'full',
      isParent: isParent || false,
      settings: {},
    })
    .returning();

  return member;
}

export async function updateGroupMember(
  memberId: string,
  data: {
    ownershipPercentage?: number;
    consolidationMethod?: 'full' | 'equity' | 'proportionate';
    isParent?: boolean;
    endDate?: Date;
  }
) {
  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.id, memberId))
    .limit(1);

  if (!existing) {
    throw new AppError('Group member not found', 404);
  }

  const updateData: Record<string, any> = {};
  if (data.ownershipPercentage !== undefined) updateData.ownershipPercentage = String(data.ownershipPercentage);
  if (data.consolidationMethod !== undefined) updateData.consolidationMethod = data.consolidationMethod;
  if (data.isParent !== undefined) updateData.isParent = data.isParent;
  if (data.endDate !== undefined) updateData.endDate = data.endDate;

  const [updated] = await db
    .update(groupMembers)
    .set(updateData)
    .where(eq(groupMembers.id, memberId))
    .returning();

  return updated;
}

export async function removeGroupMember(memberId: string) {
  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.id, memberId))
    .limit(1);

  if (!existing) {
    throw new AppError('Group member not found', 404);
  }

  await db.delete(groupMembers).where(eq(groupMembers.id, memberId));

  return { success: true };
}

export async function getOrgAccess(userId: string) {
  const accessRecords = await db
    .select({
      id: userOrganisationAccess.id,
      orgId: userOrganisationAccess.orgId,
      orgName: organisations.name,
      orgCurrency: organisations.baseCurrency,
      role: userOrganisationAccess.role,
      isDefault: userOrganisationAccess.isDefault,
    })
    .from(userOrganisationAccess)
    .leftJoin(organisations, eq(userOrganisationAccess.orgId, organisations.id))
    .where(eq(userOrganisationAccess.userId, userId));

  // Also include user's primary org if not in access records
  const [user] = await db
    .select({ organisationId: users.organisationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.organisationId) {
    const alreadyHas = accessRecords.some(r => r.orgId === user.organisationId);
    if (!alreadyHas) {
      const [org] = await db
        .select({
          id: organisations.id,
          name: organisations.name,
          baseCurrency: organisations.baseCurrency,
        })
        .from(organisations)
        .where(eq(organisations.id, user.organisationId))
        .limit(1);

      if (org) {
        accessRecords.push({
          id: '',
          orgId: org.id,
          orgName: org.name,
          orgCurrency: org.baseCurrency,
          role: 'owner' as any,
          isDefault: true,
        });
      }
    }
  }

  return accessRecords;
}

export async function switchOrg(userId: string, orgId: string) {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) {
    throw new AppError('Organisation not found', 404);
  }

  // Verify user has access to this org
  const accessRecord = await db
    .select()
    .from(userOrganisationAccess)
    .where(and(
      eq(userOrganisationAccess.userId, userId),
      eq(userOrganisationAccess.orgId, orgId),
    ))
    .limit(1);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Allow if user has explicit access OR it's their primary org
  if (!accessRecord.length && user.organisationId !== orgId) {
    throw new AppError('User does not have access to this organisation', 403);
  }

  // Update the user's active organisation
  await db
    .update(users)
    .set({ organisationId: orgId })
    .where(eq(users.id, userId));

  // Set this org as default in access records
  if (accessRecord.length > 0) {
    await db
      .update(userOrganisationAccess)
      .set({ isDefault: false })
      .where(eq(userOrganisationAccess.userId, userId));

    await db
      .update(userOrganisationAccess)
      .set({ isDefault: true })
      .where(eq(userOrganisationAccess.id, accessRecord[0].id));
  }

  return { orgId, orgName: org.name };
}
