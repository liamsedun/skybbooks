import { sql, eq, and, or, like, desc, count, isNull } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrJobOpenings, hrCandidates, hrCandidateApplications,
  hrOnboardingTasks, hrDepartments, hrDesignations,
  hrEmployees, hrJobStatusEnum, hrApplicationStatusEnum
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { dispatchEvent } from './workflow.service';

// ── Job Openings ──

export interface JobFilters { departmentId?: string; status?: string; }

export async function getJobOpenings(orgId: string, filters?: JobFilters) {
  try {
    const conditions: any[] = [eq(hrJobOpenings.orgId, orgId)];
    if (filters?.departmentId) conditions.push(eq(hrJobOpenings.departmentId, filters.departmentId));
    if (filters?.status) conditions.push(eq(hrJobOpenings.status, filters.status as any));

    return db
      .select({
        id: hrJobOpenings.id,
        orgId: hrJobOpenings.orgId,
        title: hrJobOpenings.title,
        departmentId: hrJobOpenings.departmentId,
        designationId: hrJobOpenings.designationId,
        description: hrJobOpenings.description,
        requirements: hrJobOpenings.requirements,
        location: hrJobOpenings.location,
        employmentType: hrJobOpenings.employmentType,
        salaryRange: hrJobOpenings.salaryRange,
        openings: hrJobOpenings.openings,
        status: hrJobOpenings.status,
        publishedAt: hrJobOpenings.publishedAt,
        closesAt: hrJobOpenings.closesAt,
        createdAt: hrJobOpenings.createdAt,
        updatedAt: hrJobOpenings.updatedAt,
        department: {
          id: hrDepartments.id,
          name: hrDepartments.name,
          code: hrDepartments.code,
        },
        designation: {
          id: hrDesignations.id,
          title: hrDesignations.title,
        },
      })
      .from(hrJobOpenings)
      .leftJoin(hrDepartments, eq(hrJobOpenings.departmentId, hrDepartments.id))
      .leftJoin(hrDesignations, eq(hrJobOpenings.designationId, hrDesignations.id))
      .where(and(...conditions))
      .orderBy(desc(hrJobOpenings.createdAt));
  } catch (err) {
    console.error('[recruitment] getJobOpenings error:', err);
    throw err;
  }
}

export async function getJobOpening(orgId: string, jobId: string) {
  try {
    const [row] = await db
      .select({
        id: hrJobOpenings.id,
        orgId: hrJobOpenings.orgId,
        title: hrJobOpenings.title,
        departmentId: hrJobOpenings.departmentId,
        designationId: hrJobOpenings.designationId,
        description: hrJobOpenings.description,
        requirements: hrJobOpenings.requirements,
        location: hrJobOpenings.location,
        employmentType: hrJobOpenings.employmentType,
        salaryRange: hrJobOpenings.salaryRange,
        openings: hrJobOpenings.openings,
        status: hrJobOpenings.status,
        publishedAt: hrJobOpenings.publishedAt,
        closesAt: hrJobOpenings.closesAt,
        createdAt: hrJobOpenings.createdAt,
        updatedAt: hrJobOpenings.updatedAt,
        department: {
          id: hrDepartments.id,
          name: hrDepartments.name,
          code: hrDepartments.code,
        },
        designation: {
          id: hrDesignations.id,
          title: hrDesignations.title,
        },
      })
      .from(hrJobOpenings)
      .leftJoin(hrDepartments, eq(hrJobOpenings.departmentId, hrDepartments.id))
      .leftJoin(hrDesignations, eq(hrJobOpenings.designationId, hrDesignations.id))
      .where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId)))
      .limit(1);

    return row;
  } catch (err) {
    console.error('[recruitment] getJobOpening error:', err);
    throw err;
  }
}

export async function createJobOpening(orgId: string, data: any) {
  try {
    const [record] = await db
      .insert(hrJobOpenings)
      .values({ ...data, orgId, status: data.status || 'draft' })
      .returning();
    await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'job_opening', entityId: record.id, description: `Created job opening: ${record.title}`, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] createJobOpening error:', err);
    throw err;
  }
}

export async function updateJobOpening(orgId: string, jobId: string, data: any) {
  try {
    const [old] = await db.select().from(hrJobOpenings).where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId))).limit(1);
    const [record] = await db
      .update(hrJobOpenings)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'job_opening', entityId: jobId, description: `Updated job opening: ${record.title}`, oldValues: old, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] updateJobOpening error:', err);
    throw err;
  }
}

export async function deleteJobOpening(orgId: string, jobId: string) {
  try {
    const [record] = await db
      .delete(hrJobOpenings)
      .where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'job_opening', entityId: jobId, description: `Deleted job opening: ${record.title}`, oldValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] deleteJobOpening error:', err);
    throw err;
  }
}

export async function publishJobOpening(orgId: string, jobId: string) {
  try {
    const [old] = await db.select().from(hrJobOpenings).where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId))).limit(1);
    const [record] = await db
      .update(hrJobOpenings)
      .set({ status: 'open' as any, publishedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: 'system', action: 'publish', entityType: 'job_opening', entityId: jobId, description: `Published job opening: ${record.title}`, oldValues: old, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] publishJobOpening error:', err);
    throw err;
  }
}

export async function closeJobOpening(orgId: string, jobId: string) {
  try {
    const [old] = await db.select().from(hrJobOpenings).where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId))).limit(1);
    const [record] = await db
      .update(hrJobOpenings)
      .set({ status: 'closed' as any, updatedAt: sql`now()` })
      .where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, jobId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: 'system', action: 'close', entityType: 'job_opening', entityId: jobId, description: `Closed job opening: ${record.title}`, oldValues: old, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] closeJobOpening error:', err);
    throw err;
  }
}

// ── Candidates ──

export interface CandidateFilters { status?: string; jobOpeningId?: string; search?: string; }

export async function getCandidates(orgId: string, filters?: CandidateFilters) {
  try {
    const conditions: any[] = [eq(hrCandidates.orgId, orgId)];

    if (filters?.jobOpeningId) {
      conditions.push(sql`${hrCandidates.id} IN (SELECT candidate_id FROM hr_candidate_applications WHERE job_opening_id = ${filters.jobOpeningId})`);
    }

    if (filters?.status) {
      conditions.push(sql`${hrCandidates.id} IN (SELECT candidate_id FROM hr_candidate_applications WHERE status = ${filters.status}::hr_application_status)`);
    }

    if (filters?.search) {
      conditions.push(or(
        like(hrCandidates.firstName, `%${filters.search}%`),
        like(hrCandidates.lastName, `%${filters.search}%`),
        like(hrCandidates.email, `%${filters.search}%`)
      ));
    }

    const candidates = await db
      .select({
        id: hrCandidates.id,
        orgId: hrCandidates.orgId,
        firstName: hrCandidates.firstName,
        lastName: hrCandidates.lastName,
        email: hrCandidates.email,
        phone: hrCandidates.phone,
        resumeUrl: hrCandidates.resumeUrl,
        coverLetter: hrCandidates.coverLetter,
        source: hrCandidates.source,
        referredBy: hrCandidates.referredBy,
        currentEmployer: hrCandidates.currentEmployer,
        currentPosition: hrCandidates.currentPosition,
        expectedSalary: hrCandidates.expectedSalary,
        notes: hrCandidates.notes,
        createdAt: hrCandidates.createdAt,
        updatedAt: hrCandidates.updatedAt,
        latestApplication: sql<any>`(
          SELECT row_to_json(app.*) FROM (
            SELECT id, job_opening_id, status, score, feedback, interview_date, interviewers,
                   offer_amount, offer_sent_at, offer_accepted_at, joined_at, created_at, updated_at
            FROM hr_candidate_applications
            WHERE candidate_id = ${hrCandidates.id}
            ORDER BY created_at DESC LIMIT 1
          ) app
        )`,
      })
      .from(hrCandidates)
      .where(and(...conditions))
      .orderBy(desc(hrCandidates.createdAt));

    return candidates;
  } catch (err) {
    console.error('[recruitment] getCandidates error:', err);
    throw err;
  }
}

export async function getCandidate(orgId: string, candidateId: string) {
  try {
    const [candidate] = await db
      .select({
        id: hrCandidates.id,
        orgId: hrCandidates.orgId,
        firstName: hrCandidates.firstName,
        lastName: hrCandidates.lastName,
        email: hrCandidates.email,
        phone: hrCandidates.phone,
        resumeUrl: hrCandidates.resumeUrl,
        coverLetter: hrCandidates.coverLetter,
        source: hrCandidates.source,
        referredBy: hrCandidates.referredBy,
        currentEmployer: hrCandidates.currentEmployer,
        currentPosition: hrCandidates.currentPosition,
        expectedSalary: hrCandidates.expectedSalary,
        notes: hrCandidates.notes,
        createdAt: hrCandidates.createdAt,
        updatedAt: hrCandidates.updatedAt,
      })
      .from(hrCandidates)
      .where(and(eq(hrCandidates.orgId, orgId), eq(hrCandidates.id, candidateId)))
      .limit(1);

    if (!candidate) return undefined;

    const applications = await db
      .select({
        id: hrCandidateApplications.id,
        orgId: hrCandidateApplications.orgId,
        candidateId: hrCandidateApplications.candidateId,
        jobOpeningId: hrCandidateApplications.jobOpeningId,
        status: hrCandidateApplications.status,
        score: hrCandidateApplications.score,
        feedback: hrCandidateApplications.feedback,
        interviewDate: hrCandidateApplications.interviewDate,
        interviewers: hrCandidateApplications.interviewers,
        offerAmount: hrCandidateApplications.offerAmount,
        offerSentAt: hrCandidateApplications.offerSentAt,
        offerAcceptedAt: hrCandidateApplications.offerAcceptedAt,
        joinedAt: hrCandidateApplications.joinedAt,
        createdAt: hrCandidateApplications.createdAt,
        updatedAt: hrCandidateApplications.updatedAt,
        jobTitle: sql<string>`(SELECT title FROM hr_job_openings WHERE id = ${hrCandidateApplications.jobOpeningId})`,
      })
      .from(hrCandidateApplications)
      .where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.candidateId, candidateId)))
      .orderBy(desc(hrCandidateApplications.createdAt));

    return { ...candidate, applications };
  } catch (err) {
    console.error('[recruitment] getCandidate error:', err);
    throw err;
  }
}

export async function createCandidate(orgId: string, data: any) {
  try {
    const { jobOpeningId, ...candidateData } = data;

    const [record] = await db
      .insert(hrCandidates)
      .values({ ...candidateData, orgId })
      .returning();

    if (jobOpeningId) {
      await db
        .insert(hrCandidateApplications)
        .values({ orgId, candidateId: record.id, jobOpeningId, status: 'new' })
        .returning();
    }

    await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'candidate', entityId: record.id, description: `Created candidate: ${record.firstName} ${record.lastName}`, newValues: record });
    try { await dispatchEvent(orgId, 'candidate.created', record.id, { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, jobOpeningId: data.jobOpeningId, source: data.source }, userId); } catch (e) { console.error('[WF] dispatch candidate.created error:', e); }
    return record;
  } catch (err) {
    console.error('[recruitment] createCandidate error:', err);
    throw err;
  }
}

export async function updateCandidate(orgId: string, candidateId: string, data: any) {
  try {
    const [old] = await db.select().from(hrCandidates).where(and(eq(hrCandidates.orgId, orgId), eq(hrCandidates.id, candidateId))).limit(1);
    const [record] = await db
      .update(hrCandidates)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(eq(hrCandidates.orgId, orgId), eq(hrCandidates.id, candidateId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'update', entityType: 'candidate', entityId: candidateId, description: `Updated candidate: ${record.firstName} ${record.lastName}`, oldValues: old, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] updateCandidate error:', err);
    throw err;
  }
}

export async function deleteCandidate(orgId: string, candidateId: string) {
  try {
    await db
      .delete(hrCandidateApplications)
      .where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.candidateId, candidateId)));

    const [record] = await db
      .delete(hrCandidates)
      .where(and(eq(hrCandidates.orgId, orgId), eq(hrCandidates.id, candidateId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: 'system', action: 'delete', entityType: 'candidate', entityId: candidateId, description: `Deleted candidate: ${record.firstName} ${record.lastName}`, oldValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] deleteCandidate error:', err);
    throw err;
  }
}

// ── Applications ──

export interface ApplicationFilters { candidateId?: string; jobOpeningId?: string; status?: string; }

export async function getApplications(orgId: string, filters?: ApplicationFilters) {
  try {
    const conditions: any[] = [eq(hrCandidateApplications.orgId, orgId)];
    if (filters?.candidateId) conditions.push(eq(hrCandidateApplications.candidateId, filters.candidateId));
    if (filters?.jobOpeningId) conditions.push(eq(hrCandidateApplications.jobOpeningId, filters.jobOpeningId));
    if (filters?.status) conditions.push(eq(hrCandidateApplications.status, filters.status as any));

    return db
      .select({
        id: hrCandidateApplications.id,
        orgId: hrCandidateApplications.orgId,
        candidateId: hrCandidateApplications.candidateId,
        jobOpeningId: hrCandidateApplications.jobOpeningId,
        status: hrCandidateApplications.status,
        score: hrCandidateApplications.score,
        feedback: hrCandidateApplications.feedback,
        interviewDate: hrCandidateApplications.interviewDate,
        interviewers: hrCandidateApplications.interviewers,
        offerAmount: hrCandidateApplications.offerAmount,
        offerSentAt: hrCandidateApplications.offerSentAt,
        offerAcceptedAt: hrCandidateApplications.offerAcceptedAt,
        joinedAt: hrCandidateApplications.joinedAt,
        createdAt: hrCandidateApplications.createdAt,
        updatedAt: hrCandidateApplications.updatedAt,
        candidate: {
          id: hrCandidates.id,
          firstName: hrCandidates.firstName,
          lastName: hrCandidates.lastName,
          email: hrCandidates.email,
          phone: hrCandidates.phone,
          resumeUrl: hrCandidates.resumeUrl,
        },
        job: {
          id: hrJobOpenings.id,
          title: hrJobOpenings.title,
          location: hrJobOpenings.location,
          status: hrJobOpenings.status,
        },
      })
      .from(hrCandidateApplications)
      .leftJoin(hrCandidates, eq(hrCandidateApplications.candidateId, hrCandidates.id))
      .leftJoin(hrJobOpenings, eq(hrCandidateApplications.jobOpeningId, hrJobOpenings.id))
      .where(and(...conditions))
      .orderBy(desc(hrCandidateApplications.createdAt));
  } catch (err) {
    console.error('[recruitment] getApplications error:', err);
    throw err;
  }
}

export async function createApplication(orgId: string, data: any) {
  try {
    const [record] = await db
      .insert(hrCandidateApplications)
      .values({ ...data, orgId, status: 'new' })
      .returning();
    await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'application', entityId: record.id, description: 'Created application', newValues: record });
    try { await dispatchEvent(orgId, 'application.created', record.id, { candidateId: data.candidateId, jobOpeningId: data.jobOpeningId, status: record.status, appliedDate: data.appliedDate }, userId); } catch (e) { console.error('[WF] dispatch application.created error:', e); }
    return record;
  } catch (err) {
    console.error('[recruitment] createApplication error:', err);
    throw err;
  }
}

export async function updateApplicationStatus(orgId: string, appId: string, status: string, data?: any) {
  try {
    const [old] = await db.select().from(hrCandidateApplications).where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.id, appId))).limit(1);

    const updateData: any = { status: status as any, updatedAt: sql`now()` };
    if (data?.score !== undefined) updateData.score = data.score;
    if (data?.feedback !== undefined) updateData.feedback = data.feedback;
    if (data?.userId) updateData.userId = data.userId;

    const [record] = await db
      .update(hrCandidateApplications)
      .set(updateData)
      .where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.id, appId)))
      .returning();

    if (record) {
      await createAuditLog({ orgId, userId: data?.userId || 'system', action: 'update_status', entityType: 'application', entityId: appId, description: `Application status changed to ${status}`, oldValues: old, newValues: record });

      if (status === 'hired') {
        const candidate = await db
          .select()
          .from(hrCandidates)
          .where(and(eq(hrCandidates.orgId, orgId), eq(hrCandidates.id, record.candidateId)))
          .limit(1)
          .then(rows => rows[0]);

        const job = await db
          .select()
          .from(hrJobOpenings)
          .where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.id, record.jobOpeningId)))
          .limit(1)
          .then(rows => rows[0]);

        if (candidate) {
          const code = await generateEmployeeCode(orgId);
          const [newEmployee] = await db.insert(hrEmployees).values({
            orgId,
            employeeCode: code,
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            email: candidate.email,
            phone: candidate.phone,
            departmentId: job?.departmentId || null,
            designationId: job?.designationId || null,
            joinDate: data?.joinedAt || sql`CURRENT_DATE`,
            employmentStatus: 'active',
            isActive: true,
          }).returning();
        }
        try { await dispatchEvent(orgId, 'candidate.hired', record.id, { candidateId: data.candidateId, jobOpeningId: data.jobOpeningId, employeeId: newEmployee?.id, hiredDate: data.effectiveDate }, userId); } catch (e) { console.error('[WF] dispatch candidate.hired error:', e); }
      }
    }

    return record;
  } catch (err) {
    console.error('[recruitment] updateApplicationStatus error:', err);
    throw err;
  }
}

async function generateEmployeeCode(orgId: string): Promise<string> {
  const [result] = await db
    .select({ maxCode: sql<string>`MAX(employee_code)` })
    .from(hrEmployees)
    .where(eq(hrEmployees.orgId, orgId));
  const lastNum = result?.maxCode ? parseInt(result.maxCode.replace('EMP', ''), 10) : 0;
  return `EMP${String(lastNum + 1).padStart(4, '0')}`;
}

export async function scheduleInterview(orgId: string, appId: string, data: any) {
  try {
    const [old] = await db.select().from(hrCandidateApplications).where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.id, appId))).limit(1);
    const [record] = await db
      .update(hrCandidateApplications)
      .set({
        interviewDate: data.interviewDate,
        interviewers: data.interviewers,
        status: data.status || 'interviewed',
        updatedAt: sql`now()`,
      })
      .where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.id, appId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'schedule_interview', entityType: 'application', entityId: appId, description: 'Interview scheduled', oldValues: old, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] scheduleInterview error:', err);
    throw err;
  }
}

export async function sendOffer(orgId: string, appId: string, data: any) {
  try {
    const [old] = await db.select().from(hrCandidateApplications).where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.id, appId))).limit(1);
    const [record] = await db
      .update(hrCandidateApplications)
      .set({
        offerAmount: data.offerAmount,
        offerSentAt: sql`now()`,
        status: 'offered',
        updatedAt: sql`now()`,
      })
      .where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.id, appId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: data.userId || 'system', action: 'send_offer', entityType: 'application', entityId: appId, description: 'Offer sent', oldValues: old, newValues: record });
    try { await dispatchEvent(orgId, 'offer.sent', record.id, { candidateId: data.candidateId, applicationId: appId, offerAmount: data.offerAmount, offerDate: data.offerDate || new Date(), status: 'sent' }, userId); } catch (e) { console.error('[WF] dispatch offer.sent error:', e); }
    return record;
  } catch (err) {
    console.error('[recruitment] sendOffer error:', err);
    throw err;
  }
}

// ── Onboarding ──

export async function getOnboardingTasks(orgId: string, empId: string) {
  try {
    return db
      .select()
      .from(hrOnboardingTasks)
      .where(and(eq(hrOnboardingTasks.orgId, orgId), eq(hrOnboardingTasks.employeeId, empId)))
      .orderBy(hrOnboardingTasks.createdAt);
  } catch (err) {
    console.error('[recruitment] getOnboardingTasks error:', err);
    throw err;
  }
}

export async function createOnboardingTask(orgId: string, data: any) {
  try {
    const [record] = await db
      .insert(hrOnboardingTasks)
      .values({ ...data, orgId })
      .returning();
    await createAuditLog({ orgId, userId: data.userId || 'system', action: 'create', entityType: 'onboarding_task', entityId: record.id, description: `Created onboarding task: ${record.taskName}`, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] createOnboardingTask error:', err);
    throw err;
  }
}

export async function completeOnboardingTask(orgId: string, taskId: string) {
  try {
    const [old] = await db.select().from(hrOnboardingTasks).where(and(eq(hrOnboardingTasks.orgId, orgId), eq(hrOnboardingTasks.id, taskId))).limit(1);
    const [record] = await db
      .update(hrOnboardingTasks)
      .set({ isCompleted: true, completedAt: sql`now()` })
      .where(and(eq(hrOnboardingTasks.orgId, orgId), eq(hrOnboardingTasks.id, taskId)))
      .returning();
    if (record) await createAuditLog({ orgId, userId: 'system', action: 'complete', entityType: 'onboarding_task', entityId: taskId, description: `Completed onboarding task: ${record.taskName}`, oldValues: old, newValues: record });
    return record;
  } catch (err) {
    console.error('[recruitment] completeOnboardingTask error:', err);
    throw err;
  }
}

export async function getOnboardingProgress(orgId: string, empId: string) {
  try {
    const allTasks = await db
      .select({ count: count() })
      .from(hrOnboardingTasks)
      .where(and(eq(hrOnboardingTasks.orgId, orgId), eq(hrOnboardingTasks.employeeId, empId)))
      .then(r => Number(r[0]?.count) || 0);

    const completedTasks = await db
      .select({ count: count() })
      .from(hrOnboardingTasks)
      .where(and(eq(hrOnboardingTasks.orgId, orgId), eq(hrOnboardingTasks.employeeId, empId), eq(hrOnboardingTasks.isCompleted, true)))
      .then(r => Number(r[0]?.count) || 0);

    return {
      total: allTasks,
      completed: completedTasks,
      percentage: allTasks > 0 ? Math.round((completedTasks / allTasks) * 100) : 0,
    };
  } catch (err) {
    console.error('[recruitment] getOnboardingProgress error:', err);
    throw err;
  }
}

// ── Recruitment Dashboard ──

export async function getRecruitmentDashboard(orgId: string) {
  try {
    const [openPositions] = await db
      .select({ count: count() })
      .from(hrJobOpenings)
      .where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.status, 'open' as any)))
      .then(r => [Number(r[0]?.count) || 0]);

    const [totalCandidates] = await db
      .select({ count: count() })
      .from(hrCandidates)
      .where(eq(hrCandidates.orgId, orgId))
      .then(r => [Number(r[0]?.count) || 0]);

    const [newApplications] = await db
      .select({ count: count() })
      .from(hrCandidateApplications)
      .where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.status, 'new' as any)))
      .then(r => [Number(r[0]?.count) || 0]);

    const [interviewsScheduled] = await db
      .select({ count: count() })
      .from(hrCandidateApplications)
      .where(and(eq(hrCandidateApplications.orgId, orgId), sql`${hrCandidateApplications.interviewDate} IS NOT NULL`))
      .then(r => [Number(r[0]?.count) || 0]);

    const [offersSent] = await db
      .select({ count: count() })
      .from(hrCandidateApplications)
      .where(and(eq(hrCandidateApplications.orgId, orgId), sql`${hrCandidateApplications.offerSentAt} IS NOT NULL`))
      .then(r => [Number(r[0]?.count) || 0]);

    const [hiredCount] = await db
      .select({ count: count() })
      .from(hrCandidateApplications)
      .where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.status, 'hired' as any)))
      .then(r => [Number(r[0]?.count) || 0]);

    const applicationsByStatus = await db
      .select({ status: hrCandidateApplications.status, val: count() })
      .from(hrCandidateApplications)
      .where(eq(hrCandidateApplications.orgId, orgId))
      .groupBy(hrCandidateApplications.status);

    return {
      openPositions,
      totalCandidates,
      newApplications,
      interviewsScheduled,
      offersSent,
      hiredCount,
      applicationsByStatus,
    };
  } catch (err) {
    console.error('[recruitment] getRecruitmentDashboard error:', err);
    throw err;
  }
}
