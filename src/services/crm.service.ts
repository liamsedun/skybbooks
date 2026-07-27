import { sql } from 'drizzle-orm';
import { db } from '../db';

export interface DealFilters {
  stageId?: string;
  status?: string;
}

export interface ActivityFilters {
  type?: string;
  status?: string;
  dealId?: string;
  contactId?: string;
}

// ── Stages ──

export async function getStages(orgId: string) {
  const result = await db.execute(sql`
    SELECT * FROM crm_stages WHERE org_id = ${orgId} ORDER BY "order" ASC
  `);
  return result.rows;
}

// ── Deals ──

export async function getDeals(orgId: string, filters?: DealFilters) {
  let query = sql`
    SELECT d.*, c.name as contact_name, c.email as contact_email, s.name as stage_name, s.color as stage_color, u.full_name as assignee_name
    FROM crm_deals d
    LEFT JOIN contacts c ON c.id = d.contact_id
    LEFT JOIN crm_stages s ON s.id = d.stage_id
    LEFT JOIN users u ON u.id = d.assigned_to
    WHERE d.org_id = ${orgId}
  `;
  if (filters?.stageId) {
    query = sql`${query} AND d.stage_id = ${filters.stageId}`;
  }
  if (filters?.status) {
    query = sql`${query} AND d.status = ${filters.status}`;
  }
  query = sql`${query} ORDER BY d.created_at DESC`;
  const result = await db.execute(query);
  return result.rows;
}

export async function getDeal(orgId: string, dealId: string) {
  const result = await db.execute(sql`
    SELECT d.*, c.name as contact_name, c.email as contact_email, s.name as stage_name, s.color as stage_color, u.full_name as assignee_name
    FROM crm_deals d
    LEFT JOIN contacts c ON c.id = d.contact_id
    LEFT JOIN crm_stages s ON s.id = d.stage_id
    LEFT JOIN users u ON u.id = d.assigned_to
    WHERE d.id = ${dealId} AND d.org_id = ${orgId}
  `);
  return result.rows[0] || null;
}

export async function createDeal(orgId: string, userId: string, data: any) {
  const result = await db.execute(sql`
    INSERT INTO crm_deals (org_id, title, contact_id, value, currency, stage_id, assigned_to, source, expected_close_date, probability, notes)
    VALUES (${orgId}, ${data.title}, ${data.contactId || null}, ${data.value || 0}, ${data.currency || 'NGN'}, ${data.stageId}, ${data.assignedTo || null}, ${data.source || 'other'}, ${data.expectedCloseDate || null}, ${data.probability || 0}, ${data.notes || null})
    RETURNING *
  `);
  return result.rows[0];
}

export async function updateDeal(orgId: string, dealId: string, data: any) {
  const setClauses: any[] = [];

  if (data.title !== undefined) setClauses.push(sql`title = ${data.title}`);
  if (data.contactId !== undefined) setClauses.push(sql`contact_id = ${data.contactId}`);
  if (data.value !== undefined) setClauses.push(sql`value = ${data.value}`);
  if (data.currency !== undefined) setClauses.push(sql`currency = ${data.currency}`);
  if (data.stageId !== undefined) setClauses.push(sql`stage_id = ${data.stageId}`);
  if (data.assignedTo !== undefined) setClauses.push(sql`assigned_to = ${data.assignedTo}`);
  if (data.source !== undefined) setClauses.push(sql`source = ${data.source}`);
  if (data.expectedCloseDate !== undefined) setClauses.push(sql`expected_close_date = ${data.expectedCloseDate}`);
  if (data.probability !== undefined) setClauses.push(sql`probability = ${data.probability}`);
  if (data.notes !== undefined) setClauses.push(sql`notes = ${data.notes}`);
  if (data.status !== undefined) setClauses.push(sql`status = ${data.status}`);
  if (data.lostReason !== undefined) setClauses.push(sql`lost_reason = ${data.lostReason}`);

  if (setClauses.length === 0) return getDeal(orgId, dealId);

  setClauses.push(sql`updated_at = now()`);

  const result = await db.execute(sql`
    UPDATE crm_deals SET ${sql.join(setClauses, sql`, `)} WHERE id = ${dealId} AND org_id = ${orgId} RETURNING *
  `);
  return result.rows[0] || null;
}

export async function deleteDeal(orgId: string, dealId: string) {
  await db.execute(sql`
    DELETE FROM crm_activities WHERE deal_id = ${dealId} AND org_id = ${orgId}
  `);
  const result = await db.execute(sql`
    DELETE FROM crm_deals WHERE id = ${dealId} AND org_id = ${orgId} RETURNING id
  `);
  return result.rows[0] || null;
}

export async function updateDealStage(orgId: string, dealId: string, stageId: string) {
  const stageResult = await db.execute(sql`
    SELECT name FROM crm_stages WHERE id = ${stageId} AND org_id = ${orgId}
  `);
  const stage = stageResult.rows[0];
  if (!stage) return null;

  const stageName = (stage as any).name as string;
  let status = 'open';
  let wonAt: Date | null = null;
  let lostAt: Date | null = null;

  if (stageName.toLowerCase() === 'closed won') {
    status = 'won';
    wonAt = new Date();
  } else if (stageName.toLowerCase() === 'closed lost') {
    status = 'lost';
    lostAt = new Date();
  }

  const result = await db.execute(sql`
    UPDATE crm_deals SET stage_id = ${stageId}, status = ${status}, won_at = ${wonAt}, lost_at = ${lostAt}, updated_at = now()
    WHERE id = ${dealId} AND org_id = ${orgId} RETURNING *
  `);
  return result.rows[0] || null;
}

// ── Activities ──

export async function getActivities(orgId: string, filters?: ActivityFilters) {
  let query = sql`
    SELECT a.*, c.name as contact_name, u.full_name as assignee_name, d.title as deal_title
    FROM crm_activities a
    LEFT JOIN contacts c ON c.id = a.contact_id
    LEFT JOIN users u ON u.id = a.assigned_to
    LEFT JOIN crm_deals d ON d.id = a.deal_id
    WHERE a.org_id = ${orgId}
  `;
  if (filters?.type) {
    query = sql`${query} AND a.type = ${filters.type}`;
  }
  if (filters?.status) {
    query = sql`${query} AND a.status = ${filters.status}`;
  }
  if (filters?.dealId) {
    query = sql`${query} AND a.deal_id = ${filters.dealId}`;
  }
  if (filters?.contactId) {
    query = sql`${query} AND a.contact_id = ${filters.contactId}`;
  }
  query = sql`${query} ORDER BY a.created_at DESC`;
  const result = await db.execute(query);
  return result.rows;
}

export async function createActivity(orgId: string, data: any) {
  const result = await db.execute(sql`
    INSERT INTO crm_activities (org_id, type, subject, description, deal_id, contact_id, assigned_to, due_date, status)
    VALUES (${orgId}, ${data.type}, ${data.subject}, ${data.description || null}, ${data.dealId || null}, ${data.contactId || null}, ${data.assignedTo || null}, ${data.dueDate || null}, ${data.status || 'pending'})
    RETURNING *
  `);
  return result.rows[0];
}

export async function updateActivity(orgId: string, activityId: string, data: any) {
  const setClauses: any[] = [];

  if (data.type !== undefined) setClauses.push(sql`type = ${data.type}`);
  if (data.subject !== undefined) setClauses.push(sql`subject = ${data.subject}`);
  if (data.description !== undefined) setClauses.push(sql`description = ${data.description}`);
  if (data.dealId !== undefined) setClauses.push(sql`deal_id = ${data.dealId}`);
  if (data.contactId !== undefined) setClauses.push(sql`contact_id = ${data.contactId}`);
  if (data.assignedTo !== undefined) setClauses.push(sql`assigned_to = ${data.assignedTo}`);
  if (data.dueDate !== undefined) setClauses.push(sql`due_date = ${data.dueDate}`);
  if (data.status !== undefined) setClauses.push(sql`status = ${data.status}`);
  if (data.completedAt !== undefined) setClauses.push(sql`completed_at = ${data.completedAt}`);

  if (setClauses.length === 0) return null;

  const result = await db.execute(sql`
    UPDATE crm_activities SET ${sql.join(setClauses, sql`, `)} WHERE id = ${activityId} AND org_id = ${orgId} RETURNING *
  `);
  return result.rows[0] || null;
}

export async function deleteActivity(orgId: string, activityId: string) {
  const result = await db.execute(sql`
    DELETE FROM crm_activities WHERE id = ${activityId} AND org_id = ${orgId} RETURNING id
  `);
  return result.rows[0] || null;
}

// ── Dashboard ──

export async function getDashboard(orgId: string) {
  const totalDealsResult = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM crm_deals WHERE org_id = ${orgId}
  `);
  const totalDeals = Number((totalDealsResult.rows[0] as any).count);

  const wonResult = await db.execute(sql`
    SELECT COUNT(*)::int as count, COALESCE(SUM(value), 0)::bigint as total_value
    FROM crm_deals WHERE org_id = ${orgId} AND status = 'won'
  `);
  const totalWon = Number((wonResult.rows[0] as any).count);
  const totalWonValue = Number((wonResult.rows[0] as any).total_value);

  const openValueResult = await db.execute(sql`
    SELECT COALESCE(SUM(value), 0)::bigint as total FROM crm_deals WHERE org_id = ${orgId} AND status = 'open'
  `);
  const totalOpenValue = Number((openValueResult.rows[0] as any).total);

  const dealsByStageResult = await db.execute(sql`
    SELECT s.id as "stageId", s.name as "stageName", COUNT(d.id)::int as count, COALESCE(SUM(d.value), 0)::bigint as value
    FROM crm_stages s
    LEFT JOIN crm_deals d ON d.stage_id = s.id AND d.org_id = ${orgId}
    WHERE s.org_id = ${orgId}
    GROUP BY s.id, s.name, s."order"
    ORDER BY s."order" ASC
  `);

  const activitiesDueTodayResult = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM crm_activities
    WHERE org_id = ${orgId} AND status = 'pending' AND due_date::date = CURRENT_DATE
  `);
  const activitiesDueToday = Number((activitiesDueTodayResult.rows[0] as any).count);

  const recentActivitiesResult = await db.execute(sql`
    SELECT a.*, u.full_name as assignee_name, d.title as deal_title
    FROM crm_activities a
    LEFT JOIN users u ON u.id = a.assigned_to
    LEFT JOIN crm_deals d ON d.id = a.deal_id
    WHERE a.org_id = ${orgId}
    ORDER BY a.created_at DESC LIMIT 10
  `);

  return {
    totalDeals,
    totalWon,
    totalWonValue,
    totalOpenValue,
    dealsByStage: dealsByStageResult.rows,
    activitiesDueToday,
    recentActivities: recentActivitiesResult.rows,
  };
}
