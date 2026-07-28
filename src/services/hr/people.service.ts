import { sql, eq, and, like, desc, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db';
import {
  hrPerformanceReviews, hrCourses, hrEnrollments,
  hrPulseSurveys, hrSurveyResponses,
  hrAnnouncements, hrRecognition,
  hrGoalCycles, hrOkrs, hrKeyResults,
  hrEmployees, hrReviewStatusEnum, hrCourseStatusEnum,
  hrSurveyStatusEnum, hrOkrTypeEnum, hrReviewTypeEnum,
  hrReviewSections, hrKpis, hrPerformanceCycles,
  hrDevelopmentPlans, hrPromotionRecommendations,
  hrApprovalConfigs, hrApprovalRequests,
  hrDevPlanStatusEnum, hrPromotionStatusEnum, hrKpiFrequencyEnum,
  hrApprovalStatusEnum,
  users
} from '../../db/schema';
import { createAuditLog, extractReqMeta } from '../audit.service';

const giverAlias = alias(hrEmployees, 'giver');
const receiverAlias = alias(hrEmployees, 'receiver');

// ── Performance Reviews ──

export interface ReviewFilters { employeeId?: string; reviewerId?: string; status?: string; }

export async function getPerformanceReviews(orgId: string, filters?: ReviewFilters) {
  try {
    const conditions: any[] = [eq(hrPerformanceReviews.orgId, orgId)];
    if (filters?.employeeId) conditions.push(eq(hrPerformanceReviews.employeeId, filters.employeeId));
    if (filters?.reviewerId) conditions.push(eq(hrPerformanceReviews.reviewerId, filters.reviewerId));
    if (filters?.status) conditions.push(eq(hrPerformanceReviews.status, filters.status as any));

    return await db
      .select({
        id: hrPerformanceReviews.id,
        orgId: hrPerformanceReviews.orgId,
        employeeId: hrPerformanceReviews.employeeId,
        reviewerId: hrPerformanceReviews.reviewerId,
        reviewPeriod: hrPerformanceReviews.reviewPeriod,
        dueDate: hrPerformanceReviews.dueDate,
        rating: hrPerformanceReviews.rating,
        reviewType: hrPerformanceReviews.reviewType,
        summary: hrPerformanceReviews.summary,
        strengths: hrPerformanceReviews.strengths,
        improvements: hrPerformanceReviews.improvements,
        goals: hrPerformanceReviews.goals,
        status: hrPerformanceReviews.status,
        submittedAt: hrPerformanceReviews.submittedAt,
        completedAt: hrPerformanceReviews.completedAt,
        createdAt: hrPerformanceReviews.createdAt,
        updatedAt: hrPerformanceReviews.updatedAt,
        employee: {
          id: hrEmployees.id,
          firstName: hrEmployees.firstName,
          lastName: hrEmployees.lastName,
          employeeCode: hrEmployees.employeeCode,
        },
        reviewer: {
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        },
      })
      .from(hrPerformanceReviews)
      .leftJoin(hrEmployees, eq(hrPerformanceReviews.employeeId, hrEmployees.id))
      .leftJoin(users, eq(hrPerformanceReviews.reviewerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(hrPerformanceReviews.createdAt));
  } catch (error) {
    console.error('[PeopleService] getPerformanceReviews error:', error);
    throw error;
  }
}

export async function getPerformanceReview(orgId: string, reviewId: string) {
  try {
    const [review] = await db
      .select({
        id: hrPerformanceReviews.id,
        orgId: hrPerformanceReviews.orgId,
        employeeId: hrPerformanceReviews.employeeId,
        reviewerId: hrPerformanceReviews.reviewerId,
        reviewPeriod: hrPerformanceReviews.reviewPeriod,
        dueDate: hrPerformanceReviews.dueDate,
        rating: hrPerformanceReviews.rating,
        reviewType: hrPerformanceReviews.reviewType,
        summary: hrPerformanceReviews.summary,
        strengths: hrPerformanceReviews.strengths,
        improvements: hrPerformanceReviews.improvements,
        goals: hrPerformanceReviews.goals,
        status: hrPerformanceReviews.status,
        submittedAt: hrPerformanceReviews.submittedAt,
        completedAt: hrPerformanceReviews.completedAt,
        createdAt: hrPerformanceReviews.createdAt,
        updatedAt: hrPerformanceReviews.updatedAt,
        employee: {
          id: hrEmployees.id,
          firstName: hrEmployees.firstName,
          lastName: hrEmployees.lastName,
          employeeCode: hrEmployees.employeeCode,
        },
        reviewer: {
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        },
      })
      .from(hrPerformanceReviews)
      .leftJoin(hrEmployees, eq(hrPerformanceReviews.employeeId, hrEmployees.id))
      .leftJoin(users, eq(hrPerformanceReviews.reviewerId, users.id))
      .where(and(
        eq(hrPerformanceReviews.orgId, orgId),
        eq(hrPerformanceReviews.id, reviewId)
      ));
    return review || null;
  } catch (error) {
    console.error('[PeopleService] getPerformanceReview error:', error);
    throw error;
  }
}

export async function createPerformanceReview(orgId: string, data: any) {
  try {
    const [review] = await db
      .insert(hrPerformanceReviews)
      .values({ orgId, ...data, status: 'draft' })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'performance_review',
      entityId: review.id,
      description: `Created performance review for period ${review.reviewPeriod}`,
      newValues: data,
    });

    return review;
  } catch (error) {
    console.error('[PeopleService] createPerformanceReview error:', error);
    throw error;
  }
}

export async function updatePerformanceReview(orgId: string, reviewId: string, data: any) {
  try {
    const [review] = await db
      .update(hrPerformanceReviews)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(
        eq(hrPerformanceReviews.orgId, orgId),
        eq(hrPerformanceReviews.id, reviewId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'update',
      entityType: 'performance_review',
      entityId: reviewId,
      description: `Updated performance review ${reviewId}`,
      oldValues: {},
      newValues: data,
    });

    return review;
  } catch (error) {
    console.error('[PeopleService] updatePerformanceReview error:', error);
    throw error;
  }
}

export async function submitPerformanceReview(orgId: string, reviewId: string) {
  try {
    const [review] = await db
      .update(hrPerformanceReviews)
      .set({ status: 'pending_review' as any, submittedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(
        eq(hrPerformanceReviews.orgId, orgId),
        eq(hrPerformanceReviews.id, reviewId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'submit',
      entityType: 'performance_review',
      entityId: reviewId,
      description: 'Performance review submitted for review',
    });

    return review;
  } catch (error) {
    console.error('[PeopleService] submitPerformanceReview error:', error);
    throw error;
  }
}

export async function completePerformanceReview(orgId: string, reviewId: string, data: any) {
  try {
    const updateData: any = {
      status: 'completed' as any,
      completedAt: sql`now()`,
      updatedAt: sql`now()`,
    };
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.strengths !== undefined) updateData.strengths = data.strengths;
    if (data.goals !== undefined) updateData.goals = data.goals;

    const [review] = await db
      .update(hrPerformanceReviews)
      .set(updateData)
      .where(and(
        eq(hrPerformanceReviews.orgId, orgId),
        eq(hrPerformanceReviews.id, reviewId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'complete',
      entityType: 'performance_review',
      entityId: reviewId,
      description: 'Performance review completed',
      newValues: updateData,
    });

    return review;
  } catch (error) {
    console.error('[PeopleService] completePerformanceReview error:', error);
    throw error;
  }
}

export async function deletePerformanceReview(orgId: string, reviewId: string) {
  try {
    const [review] = await db
      .delete(hrPerformanceReviews)
      .where(and(
        eq(hrPerformanceReviews.orgId, orgId),
        eq(hrPerformanceReviews.id, reviewId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'performance_review',
      entityId: reviewId,
      description: 'Deleted performance review',
    });

    return review;
  } catch (error) {
    console.error('[PeopleService] deletePerformanceReview error:', error);
    throw error;
  }
}

// ── LMS Courses ──

export interface CourseFilters { category?: string; level?: string; status?: string; }

export async function getCourses(orgId: string, filters?: CourseFilters) {
  try {
    const conditions: any[] = [eq(hrCourses.orgId, orgId)];
    if (filters?.category) conditions.push(eq(hrCourses.category, filters.category));
    if (filters?.level) conditions.push(eq(hrCourses.level, filters.level as any));
    if (filters?.status) conditions.push(eq(hrCourses.status, filters.status as any));

    return await db
      .select()
      .from(hrCourses)
      .where(and(...conditions))
      .orderBy(hrCourses.title);
  } catch (error) {
    console.error('[PeopleService] getCourses error:', error);
    throw error;
  }
}

export async function getCourse(orgId: string, courseId: string) {
  try {
    const [course] = await db
      .select()
      .from(hrCourses)
      .where(and(
        eq(hrCourses.orgId, orgId),
        eq(hrCourses.id, courseId)
      ));
    return course || null;
  } catch (error) {
    console.error('[PeopleService] getCourse error:', error);
    throw error;
  }
}

export async function createCourse(orgId: string, data: any) {
  try {
    const [course] = await db
      .insert(hrCourses)
      .values({ orgId, ...data })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'course',
      entityId: course.id,
      description: `Created course "${course.title}"`,
      newValues: data,
    });

    return course;
  } catch (error) {
    console.error('[PeopleService] createCourse error:', error);
    throw error;
  }
}

export async function updateCourse(orgId: string, courseId: string, data: any) {
  try {
    const [course] = await db
      .update(hrCourses)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(
        eq(hrCourses.orgId, orgId),
        eq(hrCourses.id, courseId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'update',
      entityType: 'course',
      entityId: courseId,
      description: `Updated course ${courseId}`,
      newValues: data,
    });

    return course;
  } catch (error) {
    console.error('[PeopleService] updateCourse error:', error);
    throw error;
  }
}

export async function deleteCourse(orgId: string, courseId: string) {
  try {
    const [course] = await db
      .delete(hrCourses)
      .where(and(
        eq(hrCourses.orgId, orgId),
        eq(hrCourses.id, courseId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'course',
      entityId: courseId,
      description: 'Deleted course',
    });

    return course;
  } catch (error) {
    console.error('[PeopleService] deleteCourse error:', error);
    throw error;
  }
}

export async function publishCourse(orgId: string, courseId: string) {
  try {
    const [course] = await db
      .update(hrCourses)
      .set({ status: 'published' as any, updatedAt: sql`now()` })
      .where(and(
        eq(hrCourses.orgId, orgId),
        eq(hrCourses.id, courseId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'publish',
      entityType: 'course',
      entityId: courseId,
      description: `Published course "${course?.title}"`,
    });

    return course;
  } catch (error) {
    console.error('[PeopleService] publishCourse error:', error);
    throw error;
  }
}

// ── Enrollments ──

export async function getEnrollments(orgId: string, courseId?: string, employeeId?: string) {
  try {
    const conditions: any[] = [eq(hrEnrollments.orgId, orgId)];
    if (courseId) conditions.push(eq(hrEnrollments.courseId, courseId));
    if (employeeId) conditions.push(eq(hrEnrollments.employeeId, employeeId));

    return await db
      .select({
        id: hrEnrollments.id,
        orgId: hrEnrollments.orgId,
        employeeId: hrEnrollments.employeeId,
        courseId: hrEnrollments.courseId,
        progress: hrEnrollments.progress,
        score: hrEnrollments.score,
        completedAt: hrEnrollments.completedAt,
        enrolledAt: hrEnrollments.enrolledAt,
        employee: {
          id: hrEmployees.id,
          firstName: hrEmployees.firstName,
          lastName: hrEmployees.lastName,
          employeeCode: hrEmployees.employeeCode,
        },
        course: {
          id: hrCourses.id,
          title: hrCourses.title,
          category: hrCourses.category,
        },
      })
      .from(hrEnrollments)
      .leftJoin(hrEmployees, eq(hrEnrollments.employeeId, hrEmployees.id))
      .leftJoin(hrCourses, eq(hrEnrollments.courseId, hrCourses.id))
      .where(and(...conditions));
  } catch (error) {
    console.error('[PeopleService] getEnrollments error:', error);
    throw error;
  }
}

export async function createEnrollment(orgId: string, data: any) {
  try {
    const [enrollment] = await db
      .insert(hrEnrollments)
      .values({ orgId, ...data })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'enrollment',
      entityId: enrollment.id,
      description: `Enrolled employee ${data.employeeId} in course ${data.courseId}`,
      newValues: data,
    });

    return enrollment;
  } catch (error) {
    console.error('[PeopleService] createEnrollment error:', error);
    throw error;
  }
}

export async function updateEnrollmentProgress(orgId: string, enrollmentId: string, progress: number) {
  try {
    const [enrollment] = await db
      .update(hrEnrollments)
      .set({ progress })
      .where(and(
        eq(hrEnrollments.orgId, orgId),
        eq(hrEnrollments.id, enrollmentId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'update',
      entityType: 'enrollment',
      entityId: enrollmentId,
      description: `Updated enrollment progress to ${progress}%`,
      newValues: { progress },
    });

    return enrollment;
  } catch (error) {
    console.error('[PeopleService] updateEnrollmentProgress error:', error);
    throw error;
  }
}

export async function completeEnrollment(orgId: string, enrollmentId: string, score?: number) {
  try {
    const updateData: any = { progress: 100, completedAt: sql`now()` };
    if (score !== undefined) updateData.score = score;

    const [enrollment] = await db
      .update(hrEnrollments)
      .set(updateData)
      .where(and(
        eq(hrEnrollments.orgId, orgId),
        eq(hrEnrollments.id, enrollmentId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'complete',
      entityType: 'enrollment',
      entityId: enrollmentId,
      description: `Completed enrollment${score !== undefined ? ` with score ${score}` : ''}`,
      newValues: updateData,
    });

    return enrollment;
  } catch (error) {
    console.error('[PeopleService] completeEnrollment error:', error);
    throw error;
  }
}

export async function deleteEnrollment(orgId: string, enrollmentId: string) {
  try {
    const [enrollment] = await db
      .delete(hrEnrollments)
      .where(and(
        eq(hrEnrollments.orgId, orgId),
        eq(hrEnrollments.id, enrollmentId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'enrollment',
      entityId: enrollmentId,
      description: 'Deleted enrollment',
    });

    return enrollment;
  } catch (error) {
    console.error('[PeopleService] deleteEnrollment error:', error);
    throw error;
  }
}

// ── Pulse Surveys ──

export interface SurveyFilters { status?: string; }

export async function getPulseSurveys(orgId: string, filters?: SurveyFilters) {
  try {
    const conditions: any[] = [eq(hrPulseSurveys.orgId, orgId)];
    if (filters?.status) conditions.push(eq(hrPulseSurveys.status, filters.status as any));

    return await db
      .select()
      .from(hrPulseSurveys)
      .where(and(...conditions))
      .orderBy(desc(hrPulseSurveys.createdAt));
  } catch (error) {
    console.error('[PeopleService] getPulseSurveys error:', error);
    throw error;
  }
}

export async function getPulseSurvey(orgId: string, surveyId: string) {
  try {
    const [survey] = await db
      .select()
      .from(hrPulseSurveys)
      .where(and(
        eq(hrPulseSurveys.orgId, orgId),
        eq(hrPulseSurveys.id, surveyId)
      ));
    return survey || null;
  } catch (error) {
    console.error('[PeopleService] getPulseSurvey error:', error);
    throw error;
  }
}

export async function createPulseSurvey(orgId: string, data: any) {
  try {
    const [survey] = await db
      .insert(hrPulseSurveys)
      .values({ orgId, ...data, status: 'draft' })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'pulse_survey',
      entityId: survey.id,
      description: `Created pulse survey "${survey.title}"`,
      newValues: data,
    });

    return survey;
  } catch (error) {
    console.error('[PeopleService] createPulseSurvey error:', error);
    throw error;
  }
}

export async function updatePulseSurvey(orgId: string, surveyId: string, data: any) {
  try {
    const [survey] = await db
      .update(hrPulseSurveys)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(
        eq(hrPulseSurveys.orgId, orgId),
        eq(hrPulseSurveys.id, surveyId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'update',
      entityType: 'pulse_survey',
      entityId: surveyId,
      description: `Updated pulse survey ${surveyId}`,
      newValues: data,
    });

    return survey;
  } catch (error) {
    console.error('[PeopleService] updatePulseSurvey error:', error);
    throw error;
  }
}

export async function launchSurvey(orgId: string, surveyId: string) {
  try {
    const [survey] = await db
      .update(hrPulseSurveys)
      .set({ status: 'active' as any, startsAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(
        eq(hrPulseSurveys.orgId, orgId),
        eq(hrPulseSurveys.id, surveyId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'launch',
      entityType: 'pulse_survey',
      entityId: surveyId,
      description: `Launched pulse survey "${survey?.title}"`,
    });

    return survey;
  } catch (error) {
    console.error('[PeopleService] launchSurvey error:', error);
    throw error;
  }
}

export async function closeSurvey(orgId: string, surveyId: string) {
  try {
    const [survey] = await db
      .update(hrPulseSurveys)
      .set({ status: 'closed' as any, closesAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(
        eq(hrPulseSurveys.orgId, orgId),
        eq(hrPulseSurveys.id, surveyId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'close',
      entityType: 'pulse_survey',
      entityId: surveyId,
      description: `Closed pulse survey "${survey?.title}"`,
    });

    return survey;
  } catch (error) {
    console.error('[PeopleService] closeSurvey error:', error);
    throw error;
  }
}

export async function deletePulseSurvey(orgId: string, surveyId: string) {
  try {
    const [survey] = await db
      .delete(hrPulseSurveys)
      .where(and(
        eq(hrPulseSurveys.orgId, orgId),
        eq(hrPulseSurveys.id, surveyId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'pulse_survey',
      entityId: surveyId,
      description: 'Deleted pulse survey',
    });

    return survey;
  } catch (error) {
    console.error('[PeopleService] deletePulseSurvey error:', error);
    throw error;
  }
}

export async function submitSurveyResponse(orgId: string, surveyId: string, employeeId: string, responses: any) {
  try {
    const [response] = await db
      .insert(hrSurveyResponses)
      .values({ orgId, surveyId, employeeId, responses })
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'submit',
      entityType: 'survey_response',
      entityId: response.id,
      description: `Employee ${employeeId} submitted survey response for ${surveyId}`,
    });

    return response;
  } catch (error) {
    console.error('[PeopleService] submitSurveyResponse error:', error);
    throw error;
  }
}

export async function getSurveyResults(orgId: string, surveyId: string) {
  try {
    const responses = await db
      .select({
        id: hrSurveyResponses.id,
        surveyId: hrSurveyResponses.surveyId,
        employeeId: hrSurveyResponses.employeeId,
        responses: hrSurveyResponses.responses,
        submittedAt: hrSurveyResponses.submittedAt,
        employee: {
          id: hrEmployees.id,
          firstName: hrEmployees.firstName,
          lastName: hrEmployees.lastName,
          employeeCode: hrEmployees.employeeCode,
        },
      })
      .from(hrSurveyResponses)
      .leftJoin(hrEmployees, eq(hrSurveyResponses.employeeId, hrEmployees.id))
      .where(and(
        eq(hrSurveyResponses.orgId, orgId),
        eq(hrSurveyResponses.surveyId, surveyId)
      ));

    const totalResponses = responses.length;

    const [totalEmployeesResult] = await db
      .select({ total: count() })
      .from(hrEmployees)
      .where(eq(hrEmployees.orgId, orgId));
    const totalEmployees = totalEmployeesResult?.total || 0;
    const responseRate = totalEmployees > 0 ? Math.round((totalResponses / totalEmployees) * 100) : 0;

    return { totalResponses, responseRate, responses };
  } catch (error) {
    console.error('[PeopleService] getSurveyResults error:', error);
    throw error;
  }
}

// ── Announcements ──

export async function getAnnouncements(orgId: string) {
  try {
    return await db
      .select({
        id: hrAnnouncements.id,
        orgId: hrAnnouncements.orgId,
        title: hrAnnouncements.title,
        content: hrAnnouncements.content,
        priority: hrAnnouncements.priority,
        authorId: hrAnnouncements.authorId,
        expiresAt: hrAnnouncements.expiresAt,
        isPinned: hrAnnouncements.isPinned,
        createdAt: hrAnnouncements.createdAt,
        author: {
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        },
      })
      .from(hrAnnouncements)
      .leftJoin(users, eq(hrAnnouncements.authorId, users.id))
      .where(eq(hrAnnouncements.orgId, orgId))
      .orderBy(desc(hrAnnouncements.createdAt));
  } catch (error) {
    console.error('[PeopleService] getAnnouncements error:', error);
    throw error;
  }
}

export async function createAnnouncement(orgId: string, data: any) {
  try {
    const [announcement] = await db
      .insert(hrAnnouncements)
      .values({ orgId, ...data })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'announcement',
      entityId: announcement.id,
      description: `Created announcement "${announcement.title}"`,
      newValues: data,
    });

    return announcement;
  } catch (error) {
    console.error('[PeopleService] createAnnouncement error:', error);
    throw error;
  }
}

export async function updateAnnouncement(orgId: string, annId: string, data: any) {
  try {
    const [announcement] = await db
      .update(hrAnnouncements)
      .set({ ...data })
      .where(and(
        eq(hrAnnouncements.orgId, orgId),
        eq(hrAnnouncements.id, annId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'update',
      entityType: 'announcement',
      entityId: annId,
      description: `Updated announcement ${annId}`,
      newValues: data,
    });

    return announcement;
  } catch (error) {
    console.error('[PeopleService] updateAnnouncement error:', error);
    throw error;
  }
}

export async function deleteAnnouncement(orgId: string, annId: string) {
  try {
    const [announcement] = await db
      .delete(hrAnnouncements)
      .where(and(
        eq(hrAnnouncements.orgId, orgId),
        eq(hrAnnouncements.id, annId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'announcement',
      entityId: annId,
      description: 'Deleted announcement',
    });

    return announcement;
  } catch (error) {
    console.error('[PeopleService] deleteAnnouncement error:', error);
    throw error;
  }
}

// ── Recognition ──

export async function getRecognition(orgId: string, employeeId?: string) {
  try {
    const conditions: any[] = [eq(hrRecognition.orgId, orgId)];
    if (employeeId) conditions.push(eq(hrRecognition.receiverId, employeeId));

    return await db
      .select({
        id: hrRecognition.id,
        orgId: hrRecognition.orgId,
        giverId: hrRecognition.giverId,
        receiverId: hrRecognition.receiverId,
        message: hrRecognition.message,
        badge: hrRecognition.badge,
        createdAt: hrRecognition.createdAt,
        giver: {
          id: giverAlias.id,
          firstName: giverAlias.firstName,
          lastName: giverAlias.lastName,
          employeeCode: giverAlias.employeeCode,
        },
        receiver: {
          id: receiverAlias.id,
          firstName: receiverAlias.firstName,
          lastName: receiverAlias.lastName,
          employeeCode: receiverAlias.employeeCode,
        },
      })
      .from(hrRecognition)
      .leftJoin(giverAlias, eq(hrRecognition.giverId, giverAlias.id))
      .leftJoin(receiverAlias, eq(hrRecognition.receiverId, receiverAlias.id))
      .where(and(...conditions))
      .orderBy(desc(hrRecognition.createdAt));
  } catch (error) {
    console.error('[PeopleService] getRecognition error:', error);
    throw error;
  }
}

export async function createRecognition(orgId: string, data: any) {
  try {
    const [rec] = await db
      .insert(hrRecognition)
      .values({ orgId, ...data })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'recognition',
      entityId: rec.id,
      description: `Recognition from ${data.giverId} to ${data.receiverId}`,
      newValues: data,
    });

    return rec;
  } catch (error) {
    console.error('[PeopleService] createRecognition error:', error);
    throw error;
  }
}

export async function deleteRecognition(orgId: string, recId: string) {
  try {
    const [rec] = await db
      .delete(hrRecognition)
      .where(and(
        eq(hrRecognition.orgId, orgId),
        eq(hrRecognition.id, recId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'recognition',
      entityId: recId,
      description: 'Deleted recognition',
    });

    return rec;
  } catch (error) {
    console.error('[PeopleService] deleteRecognition error:', error);
    throw error;
  }
}

// ── OKR & Goals ──

export async function getGoalCycles(orgId: string) {
  try {
    return await db
      .select()
      .from(hrGoalCycles)
      .where(eq(hrGoalCycles.orgId, orgId))
      .orderBy(desc(hrGoalCycles.startDate));
  } catch (error) {
    console.error('[PeopleService] getGoalCycles error:', error);
    throw error;
  }
}

export async function createGoalCycle(orgId: string, data: any) {
  try {
    const [cycle] = await db
      .insert(hrGoalCycles)
      .values({ orgId, ...data })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'goal_cycle',
      entityId: cycle.id,
      description: `Created goal cycle "${cycle.name}"`,
      newValues: data,
    });

    return cycle;
  } catch (error) {
    console.error('[PeopleService] createGoalCycle error:', error);
    throw error;
  }
}

export async function updateGoalCycle(orgId: string, cycleId: string, data: any) {
  try {
    const [cycle] = await db
      .update(hrGoalCycles)
      .set({ ...data })
      .where(and(
        eq(hrGoalCycles.orgId, orgId),
        eq(hrGoalCycles.id, cycleId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'update',
      entityType: 'goal_cycle',
      entityId: cycleId,
      description: `Updated goal cycle ${cycleId}`,
      newValues: data,
    });

    return cycle;
  } catch (error) {
    console.error('[PeopleService] updateGoalCycle error:', error);
    throw error;
  }
}

export interface OkrFilters { cycleId?: string; ownerId?: string; }

export async function getOkrs(orgId: string, filters?: OkrFilters) {
  try {
    const conditions: any[] = [eq(hrOkrs.orgId, orgId)];
    if (filters?.cycleId) conditions.push(eq(hrOkrs.cycleId, filters.cycleId));
    if (filters?.ownerId) conditions.push(eq(hrOkrs.ownerId, filters.ownerId));

    return await db
      .select({
        id: hrOkrs.id,
        orgId: hrOkrs.orgId,
        cycleId: hrOkrs.cycleId,
        ownerId: hrOkrs.ownerId,
        title: hrOkrs.title,
        description: hrOkrs.description,
        type: hrOkrs.type,
        progress: hrOkrs.progress,
        isActive: hrOkrs.isActive,
        createdAt: hrOkrs.createdAt,
        updatedAt: hrOkrs.updatedAt,
        cycle: {
          id: hrGoalCycles.id,
          name: hrGoalCycles.name,
          startDate: hrGoalCycles.startDate,
          endDate: hrGoalCycles.endDate,
        },
        owner: {
          id: hrEmployees.id,
          firstName: hrEmployees.firstName,
          lastName: hrEmployees.lastName,
          employeeCode: hrEmployees.employeeCode,
        },
      })
      .from(hrOkrs)
      .leftJoin(hrGoalCycles, eq(hrOkrs.cycleId, hrGoalCycles.id))
      .leftJoin(hrEmployees, eq(hrOkrs.ownerId, hrEmployees.id))
      .where(and(...conditions))
      .orderBy(desc(hrOkrs.createdAt));
  } catch (error) {
    console.error('[PeopleService] getOkrs error:', error);
    throw error;
  }
}

export async function getOkr(orgId: string, okrId: string) {
  try {
    const [okr] = await db
      .select({
        id: hrOkrs.id,
        orgId: hrOkrs.orgId,
        cycleId: hrOkrs.cycleId,
        ownerId: hrOkrs.ownerId,
        title: hrOkrs.title,
        description: hrOkrs.description,
        type: hrOkrs.type,
        progress: hrOkrs.progress,
        isActive: hrOkrs.isActive,
        createdAt: hrOkrs.createdAt,
        updatedAt: hrOkrs.updatedAt,
        cycle: {
          id: hrGoalCycles.id,
          name: hrGoalCycles.name,
          startDate: hrGoalCycles.startDate,
          endDate: hrGoalCycles.endDate,
        },
        owner: {
          id: hrEmployees.id,
          firstName: hrEmployees.firstName,
          lastName: hrEmployees.lastName,
          employeeCode: hrEmployees.employeeCode,
        },
      })
      .from(hrOkrs)
      .leftJoin(hrGoalCycles, eq(hrOkrs.cycleId, hrGoalCycles.id))
      .leftJoin(hrEmployees, eq(hrOkrs.ownerId, hrEmployees.id))
      .where(and(eq(hrOkrs.orgId, orgId), eq(hrOkrs.id, okrId)));

    if (!okr) return null;

    const keyResults = await getKeyResults(orgId, okrId);
    return { ...okr, keyResults };
  } catch (error) {
    console.error('[PeopleService] getOkr error:', error);
    throw error;
  }
}

export async function createOkr(orgId: string, data: any) {
  try {
    const [okr] = await db
      .insert(hrOkrs)
      .values({ orgId, ...data })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'okr',
      entityId: okr.id,
      description: `Created OKR "${okr.title}"`,
      newValues: data,
    });

    return okr;
  } catch (error) {
    console.error('[PeopleService] createOkr error:', error);
    throw error;
  }
}

export async function updateOkr(orgId: string, okrId: string, data: any) {
  try {
    const [okr] = await db
      .update(hrOkrs)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(
        eq(hrOkrs.orgId, orgId),
        eq(hrOkrs.id, okrId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'update',
      entityType: 'okr',
      entityId: okrId,
      description: `Updated OKR ${okrId}`,
      newValues: data,
    });

    return okr;
  } catch (error) {
    console.error('[PeopleService] updateOkr error:', error);
    throw error;
  }
}

export async function deleteOkr(orgId: string, okrId: string) {
  try {
    await db
      .delete(hrKeyResults)
      .where(and(eq(hrKeyResults.orgId, orgId), eq(hrKeyResults.okrId, okrId)));

    const [okr] = await db
      .delete(hrOkrs)
      .where(and(eq(hrOkrs.orgId, orgId), eq(hrOkrs.id, okrId)))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'okr',
      entityId: okrId,
      description: `Deleted OKR "${okr?.title}"`,
    });

    return okr;
  } catch (error) {
    console.error('[PeopleService] deleteOkr error:', error);
    throw error;
  }
}

export async function getKeyResults(orgId: string, okrId: string) {
  try {
    return await db
      .select()
      .from(hrKeyResults)
      .where(and(
        eq(hrKeyResults.orgId, orgId),
        eq(hrKeyResults.okrId, okrId)
      ));
  } catch (error) {
    console.error('[PeopleService] getKeyResults error:', error);
    throw error;
  }
}

export async function createKeyResult(orgId: string, data: any) {
  try {
    const [kr] = await db
      .insert(hrKeyResults)
      .values({ orgId, ...data })
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'create',
      entityType: 'key_result',
      entityId: kr.id,
      description: `Created key result "${kr.title}"`,
      newValues: data,
    });

    await recalculateOkrProgress(orgId, data.okrId);

    return kr;
  } catch (error) {
    console.error('[PeopleService] createKeyResult error:', error);
    throw error;
  }
}

export async function updateKeyResult(orgId: string, krId: string, data: any) {
  try {
    const [kr] = await db
      .update(hrKeyResults)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(
        eq(hrKeyResults.orgId, orgId),
        eq(hrKeyResults.id, krId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: data.userId || 'system',
      action: 'update',
      entityType: 'key_result',
      entityId: krId,
      description: `Updated key result ${krId}`,
      newValues: data,
    });

    await recalculateOkrProgress(orgId, kr.okrId);

    return kr;
  } catch (error) {
    console.error('[PeopleService] updateKeyResult error:', error);
    throw error;
  }
}

export async function deleteKeyResult(orgId: string, krId: string) {
  try {
    const [kr] = await db
      .delete(hrKeyResults)
      .where(and(
        eq(hrKeyResults.orgId, orgId),
        eq(hrKeyResults.id, krId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'key_result',
      entityId: krId,
      description: 'Deleted key result',
    });

    if (kr) await recalculateOkrProgress(orgId, kr.okrId);

    return kr;
  } catch (error) {
    console.error('[PeopleService] deleteKeyResult error:', error);
    throw error;
  }
}

export async function updateKeyResultProgress(orgId: string, krId: string, currentValue: number) {
  try {
    const [kr] = await db
      .update(hrKeyResults)
      .set({ currentValue: String(currentValue), updatedAt: sql`now()` })
      .where(and(
        eq(hrKeyResults.orgId, orgId),
        eq(hrKeyResults.id, krId)
      ))
      .returning();

    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'update_progress',
      entityType: 'key_result',
      entityId: krId,
      description: `Updated key result progress to ${currentValue}`,
      newValues: { currentValue },
    });

    await recalculateOkrProgress(orgId, kr.okrId);

    return kr;
  } catch (error) {
    console.error('[PeopleService] updateKeyResultProgress error:', error);
    throw error;
  }
}

export async function recalculateOkrProgress(orgId: string, okrId: string) {
  try {
    const keyResults = await db
      .select()
      .from(hrKeyResults)
      .where(and(
        eq(hrKeyResults.orgId, orgId),
        eq(hrKeyResults.okrId, okrId),
        eq(hrKeyResults.isActive, true)
      ));

    let totalProgress = 0;
    let count = 0;
    for (const kr of keyResults) {
      const target = Number(kr.targetValue);
      const current = Number(kr.currentValue);
      if (target > 0) {
        totalProgress += Math.min(Math.round((current / target) * 100), 100);
        count++;
      }
    }
    const progress = count > 0 ? Math.round(totalProgress / count) : 0;

    const [okr] = await db
      .update(hrOkrs)
      .set({ progress, updatedAt: sql`now()` })
      .where(and(eq(hrOkrs.orgId, orgId), eq(hrOkrs.id, okrId)))
      .returning();

    return okr;
  } catch (error) {
    console.error('[PeopleService] recalculateOkrProgress error:', error);
    throw error;
  }
}

// ── People Dashboard ──

export async function getPeopleDashboard(orgId: string) {
  try {
    const [reviewCount] = await db
      .select({ count: count() })
      .from(hrPerformanceReviews)
      .where(eq(hrPerformanceReviews.orgId, orgId));
    const totalReviews = reviewCount?.count || 0;

    const [pendingReviewsCount] = await db
      .select({ count: count() })
      .from(hrPerformanceReviews)
      .where(and(
        eq(hrPerformanceReviews.orgId, orgId),
        eq(hrPerformanceReviews.status, 'pending_review' as any)
      ));
    const pendingReviews = pendingReviewsCount?.count || 0;

    const [courseCount] = await db
      .select({ count: count() })
      .from(hrCourses)
      .where(eq(hrCourses.orgId, orgId));
    const totalCourses = courseCount?.count || 0;

    const [surveyCount] = await db
      .select({ count: count() })
      .from(hrPulseSurveys)
      .where(eq(hrPulseSurveys.orgId, orgId));
    const totalSurveys = surveyCount?.count || 0;

    const [activeSurveysCount] = await db
      .select({ count: count() })
      .from(hrPulseSurveys)
      .where(and(
        eq(hrPulseSurveys.orgId, orgId),
        eq(hrPulseSurveys.status, 'active' as any)
      ));
    const activeSurveys = activeSurveysCount?.count || 0;

    const [announcementCount] = await db
      .select({ count: count() })
      .from(hrAnnouncements)
      .where(eq(hrAnnouncements.orgId, orgId));
    const totalAnnouncements = announcementCount?.count || 0;

    const recentRecognition = await db
      .select()
      .from(hrRecognition)
      .where(eq(hrRecognition.orgId, orgId))
      .orderBy(desc(hrRecognition.createdAt))
      .limit(5);

    const [activeOkrsCount] = await db
      .select({ count: count() })
      .from(hrOkrs)
      .where(and(
        eq(hrOkrs.orgId, orgId),
        eq(hrOkrs.isActive, true)
      ));
    const activeOkrs = activeOkrsCount?.count || 0;

    return {
      totalReviews,
      pendingReviews,
      totalCourses,
      totalSurveys,
      activeSurveys,
      totalAnnouncements,
      recentRecognition,
      activeOkrs,
    };
  } catch (error) {
    console.error('[PeopleService] getPeopleDashboard error:', error);
    throw error;
  }
}

// ── KPIs ──

export async function getKpis(orgId: string, employeeId?: string) {
  try {
    const conditions: any[] = [eq(hrKpis.orgId, orgId)];
    if (employeeId) conditions.push(eq(hrKpis.employeeId, employeeId));
    return await db.select().from(hrKpis).where(and(...conditions)).orderBy(desc(hrKpis.createdAt));
  } catch (error) { console.error('[PeopleService] getKpis error:', error); throw error; }
}

export async function getKpi(orgId: string, kpiId: string) {
  try {
    const [row] = await db.select().from(hrKpis).where(and(eq(hrKpis.id, kpiId), eq(hrKpis.orgId, orgId)));
    if (!row) throw new Error('KPI not found');
    return row;
  } catch (error) { console.error('[PeopleService] getKpi error:', error); throw error; }
}

export async function createKpi(orgId: string, data: any) {
  try {
    const [row] = await db.insert(hrKpis).values({ orgId, ...data }).returning();
    await createAuditLog({ action: 'create', entity: 'kpi', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] createKpi error:', error); throw error; }
}

export async function updateKpi(orgId: string, kpiId: string, data: any) {
  try {
    const [row] = await db.update(hrKpis).set({ ...data, updatedAt: new Date() }).where(and(eq(hrKpis.id, kpiId), eq(hrKpis.orgId, orgId))).returning();
    if (!row) throw new Error('KPI not found');
    await createAuditLog({ action: 'update', entity: 'kpi', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] updateKpi error:', error); throw error; }
}

export async function deleteKpi(orgId: string, kpiId: string) {
  try {
    await db.delete(hrKpis).where(and(eq(hrKpis.id, kpiId), eq(hrKpis.orgId, orgId)));
    await createAuditLog({ action: 'delete', entity: 'kpi', entityId: kpiId, ...extractReqMeta({} as any) });
  } catch (error) { console.error('[PeopleService] deleteKpi error:', error); throw error; }
}

// ── Performance Cycles ──

export async function getPerformanceCycles(orgId: string) {
  try {
    return await db.select().from(hrPerformanceCycles).where(eq(hrPerformanceCycles.orgId, orgId)).orderBy(desc(hrPerformanceCycles.createdAt));
  } catch (error) { console.error('[PeopleService] getPerformanceCycles error:', error); throw error; }
}

export async function getPerformanceCycle(orgId: string, cycleId: string) {
  try {
    const [row] = await db.select().from(hrPerformanceCycles).where(and(eq(hrPerformanceCycles.id, cycleId), eq(hrPerformanceCycles.orgId, orgId)));
    if (!row) throw new Error('Performance cycle not found');
    return row;
  } catch (error) { console.error('[PeopleService] getPerformanceCycle error:', error); throw error; }
}

export async function createPerformanceCycle(orgId: string, data: any) {
  try {
    const [row] = await db.insert(hrPerformanceCycles).values({ orgId, ...data }).returning();
    await createAuditLog({ action: 'create', entity: 'performance_cycle', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] createPerformanceCycle error:', error); throw error; }
}

export async function updatePerformanceCycle(orgId: string, cycleId: string, data: any) {
  try {
    const [row] = await db.update(hrPerformanceCycles).set(data).where(and(eq(hrPerformanceCycles.id, cycleId), eq(hrPerformanceCycles.orgId, orgId))).returning();
    if (!row) throw new Error('Performance cycle not found');
    await createAuditLog({ action: 'update', entity: 'performance_cycle', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] updatePerformanceCycle error:', error); throw error; }
}

export async function deletePerformanceCycle(orgId: string, cycleId: string) {
  try {
    await db.delete(hrPerformanceCycles).where(and(eq(hrPerformanceCycles.id, cycleId), eq(hrPerformanceCycles.orgId, orgId)));
    await createAuditLog({ action: 'delete', entity: 'performance_cycle', entityId: cycleId, ...extractReqMeta({} as any) });
  } catch (error) { console.error('[PeopleService] deletePerformanceCycle error:', error); throw error; }
}

// ── Review Sections ──

export async function getReviewSections(orgId: string, reviewId: string) {
  try {
    return await db.select().from(hrReviewSections).where(and(eq(hrReviewSections.reviewId, reviewId), eq(hrReviewSections.orgId, orgId)));
  } catch (error) { console.error('[PeopleService] getReviewSections error:', error); throw error; }
}

export async function createReviewSection(orgId: string, data: any) {
  try {
    const [row] = await db.insert(hrReviewSections).values({ orgId, ...data }).returning();
    return row;
  } catch (error) { console.error('[PeopleService] createReviewSection error:', error); throw error; }
}

export async function updateReviewSection(orgId: string, sectionId: string, data: any) {
  try {
    const [row] = await db.update(hrReviewSections).set(data).where(and(eq(hrReviewSections.id, sectionId), eq(hrReviewSections.orgId, orgId))).returning();
    if (!row) throw new Error('Review section not found');
    return row;
  } catch (error) { console.error('[PeopleService] updateReviewSection error:', error); throw error; }
}

export async function deleteReviewSection(orgId: string, sectionId: string) {
  try {
    await db.delete(hrReviewSections).where(and(eq(hrReviewSections.id, sectionId), eq(hrReviewSections.orgId, orgId)));
  } catch (error) { console.error('[PeopleService] deleteReviewSection error:', error); throw error; }
}

// ── Development Plans ──

export async function getDevelopmentPlans(orgId: string, employeeId?: string) {
  try {
    const conditions: any[] = [eq(hrDevelopmentPlans.orgId, orgId)];
    if (employeeId) conditions.push(eq(hrDevelopmentPlans.employeeId, employeeId));
    return await db.select().from(hrDevelopmentPlans).where(and(...conditions)).orderBy(desc(hrDevelopmentPlans.createdAt));
  } catch (error) { console.error('[PeopleService] getDevelopmentPlans error:', error); throw error; }
}

export async function getDevelopmentPlan(orgId: string, planId: string) {
  try {
    const [row] = await db.select().from(hrDevelopmentPlans).where(and(eq(hrDevelopmentPlans.id, planId), eq(hrDevelopmentPlans.orgId, orgId)));
    if (!row) throw new Error('Development plan not found');
    return row;
  } catch (error) { console.error('[PeopleService] getDevelopmentPlan error:', error); throw error; }
}

export async function createDevelopmentPlan(orgId: string, data: any) {
  try {
    const [row] = await db.insert(hrDevelopmentPlans).values({ orgId, ...data }).returning();
    await createAuditLog({ action: 'create', entity: 'development_plan', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] createDevelopmentPlan error:', error); throw error; }
}

export async function updateDevelopmentPlan(orgId: string, planId: string, data: any) {
  try {
    const [row] = await db.update(hrDevelopmentPlans).set({ ...data, updatedAt: new Date() }).where(and(eq(hrDevelopmentPlans.id, planId), eq(hrDevelopmentPlans.orgId, orgId))).returning();
    if (!row) throw new Error('Development plan not found');
    await createAuditLog({ action: 'update', entity: 'development_plan', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] updateDevelopmentPlan error:', error); throw error; }
}

export async function deleteDevelopmentPlan(orgId: string, planId: string) {
  try {
    await db.delete(hrDevelopmentPlans).where(and(eq(hrDevelopmentPlans.id, planId), eq(hrDevelopmentPlans.orgId, orgId)));
    await createAuditLog({ action: 'delete', entity: 'development_plan', entityId: planId, ...extractReqMeta({} as any) });
  } catch (error) { console.error('[PeopleService] deleteDevelopmentPlan error:', error); throw error; }
}

// ── Promotion Recommendations ──

export async function getPromotionRecommendations(orgId: string, status?: string) {
  try {
    const conditions: any[] = [eq(hrPromotionRecommendations.orgId, orgId)];
    if (status) conditions.push(eq(hrPromotionRecommendations.status, status as any));
    return await db.select().from(hrPromotionRecommendations).where(and(...conditions)).orderBy(desc(hrPromotionRecommendations.createdAt));
  } catch (error) { console.error('[PeopleService] getPromotionRecommendations error:', error); throw error; }
}

export async function getPromotionRecommendation(orgId: string, recId: string) {
  try {
    const [row] = await db.select().from(hrPromotionRecommendations).where(and(eq(hrPromotionRecommendations.id, recId), eq(hrPromotionRecommendations.orgId, orgId)));
    if (!row) throw new Error('Promotion recommendation not found');
    return row;
  } catch (error) { console.error('[PeopleService] getPromotionRecommendation error:', error); throw error; }
}

export async function createPromotionRecommendation(orgId: string, data: any) {
  try {
    const [row] = await db.insert(hrPromotionRecommendations).values({ orgId, ...data }).returning();
    await createAuditLog({ action: 'create', entity: 'promotion_recommendation', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] createPromotionRecommendation error:', error); throw error; }
}

export async function updatePromotionRecommendation(orgId: string, recId: string, data: any) {
  try {
    const [row] = await db.update(hrPromotionRecommendations).set({ ...data, updatedAt: new Date() }).where(and(eq(hrPromotionRecommendations.id, recId), eq(hrPromotionRecommendations.orgId, orgId))).returning();
    if (!row) throw new Error('Promotion recommendation not found');
    await createAuditLog({ action: 'update', entity: 'promotion_recommendation', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] updatePromotionRecommendation error:', error); throw error; }
}

export async function approvePromotionRecommendation(orgId: string, recId: string, approvedBy: string) {
  try {
    const [row] = await db.update(hrPromotionRecommendations).set({ status: 'approved', approvedBy, decidedAt: new Date() }).where(and(eq(hrPromotionRecommendations.id, recId), eq(hrPromotionRecommendations.orgId, orgId))).returning();
    if (!row) throw new Error('Promotion recommendation not found');
    await createAuditLog({ action: 'update', entity: 'promotion_recommendation', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] approvePromotionRecommendation error:', error); throw error; }
}

export async function rejectPromotionRecommendation(orgId: string, recId: string) {
  try {
    const [row] = await db.update(hrPromotionRecommendations).set({ status: 'rejected', decidedAt: new Date() }).where(and(eq(hrPromotionRecommendations.id, recId), eq(hrPromotionRecommendations.orgId, orgId))).returning();
    if (!row) throw new Error('Promotion recommendation not found');
    await createAuditLog({ action: 'update', entity: 'promotion_recommendation', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] rejectPromotionRecommendation error:', error); throw error; }
}

export async function deletePromotionRecommendation(orgId: string, recId: string) {
  try {
    await db.delete(hrPromotionRecommendations).where(and(eq(hrPromotionRecommendations.id, recId), eq(hrPromotionRecommendations.orgId, orgId)));
    await createAuditLog({ action: 'delete', entity: 'promotion_recommendation', entityId: recId, ...extractReqMeta({} as any) });
  } catch (error) { console.error('[PeopleService] deletePromotionRecommendation error:', error); throw error; }
}

// ── Approval Workflow ──

export async function getApprovalConfigs(orgId: string) {
  try {
    return await db.select().from(hrApprovalConfigs).where(eq(hrApprovalConfigs.orgId, orgId));
  } catch (error) { console.error('[PeopleService] getApprovalConfigs error:', error); throw error; }
}

export async function createApprovalConfig(orgId: string, data: any) {
  try {
    const [row] = await db.insert(hrApprovalConfigs).values({ orgId, ...data }).returning();
    return row;
  } catch (error) { console.error('[PeopleService] createApprovalConfig error:', error); throw error; }
}

export async function updateApprovalConfig(orgId: string, configId: string, data: any) {
  try {
    const [row] = await db.update(hrApprovalConfigs).set({ ...data, updatedAt: new Date() }).where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId))).returning();
    return row;
  } catch (error) { console.error('[PeopleService] updateApprovalConfig error:', error); throw error; }
}

export async function deleteApprovalConfig(orgId: string, configId: string) {
  try {
    await db.delete(hrApprovalConfigs).where(and(eq(hrApprovalConfigs.id, configId), eq(hrApprovalConfigs.orgId, orgId)));
  } catch (error) { console.error('[PeopleService] deleteApprovalConfig error:', error); throw error; }
}

export async function getApprovalRequests(orgId: string, module?: string, status?: string) {
  try {
    const conditions: any[] = [eq(hrApprovalRequests.orgId, orgId)];
    if (module) conditions.push(eq(hrApprovalRequests.module, module));
    if (status) conditions.push(eq(hrApprovalRequests.status, status as any));
    return await db.select().from(hrApprovalRequests).where(and(...conditions)).orderBy(desc(hrApprovalRequests.createdAt));
  } catch (error) { console.error('[PeopleService] getApprovalRequests error:', error); throw error; }
}

export async function createApprovalRequest(orgId: string, data: any) {
  try {
    const [row] = await db.insert(hrApprovalRequests).values({ orgId, ...data }).returning();
    await createAuditLog({ action: 'create', entity: 'approval_request', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] createApprovalRequest error:', error); throw error; }
}

export async function approveApprovalRequest(orgId: string, requestId: string, comment?: string) {
  try {
    const [row] = await db.update(hrApprovalRequests).set({ status: 'approved', comment, decidedAt: new Date() }).where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).returning();
    if (!row) throw new Error('Approval request not found');
    await createAuditLog({ action: 'update', entity: 'approval_request', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] approveApprovalRequest error:', error); throw error; }
}

export async function rejectApprovalRequest(orgId: string, requestId: string, comment?: string) {
  try {
    const [row] = await db.update(hrApprovalRequests).set({ status: 'rejected', comment, decidedAt: new Date() }).where(and(eq(hrApprovalRequests.id, requestId), eq(hrApprovalRequests.orgId, orgId))).returning();
    if (!row) throw new Error('Approval request not found');
    await createAuditLog({ action: 'update', entity: 'approval_request', entityId: row.id, ...extractReqMeta({} as any) });
    return row;
  } catch (error) { console.error('[PeopleService] rejectApprovalRequest error:', error); throw error; }
}

// ── Performance Reports & Analytics ──

export async function getPerformanceAnalytics(orgId: string, dateFrom?: string, dateTo?: string) {
  try {
    const conditions: any[] = [eq(hrPerformanceReviews.orgId, orgId)];
    conditions.push(eq(hrPerformanceReviews.status as any, 'completed'));
    if (dateFrom) conditions.push(sql`${hrPerformanceReviews.completedAt} >= ${dateFrom}`);
    if (dateTo) conditions.push(sql`${hrPerformanceReviews.completedAt} <= ${dateTo}`);

    const reviews = await db.select({
      rating: hrPerformanceReviews.rating,
      reviewType: hrPerformanceReviews.reviewType,
    }).from(hrPerformanceReviews).where(and(...conditions));

    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 ? reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / totalReviews : 0;
    const ratingDistribution: Record<number, number> = {};
    reviews.forEach(r => { if (r.rating) ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1; });
    const byType: Record<string, number> = {};
    reviews.forEach(r => { byType[r.reviewType] = (byType[r.reviewType] || 0) + 1; });

    const totalKpis = await db.select({ count: count() }).from(hrKpis).where(eq(hrKpis.orgId, orgId));
    const activeKpis = await db.select({ count: count() }).from(hrKpis).where(and(eq(hrKpis.orgId, orgId), eq(hrKpis.isActive, true)));
    const activeDevPlans = await db.select({ count: count() }).from(hrDevelopmentPlans).where(and(eq(hrDevelopmentPlans.orgId, orgId), eq(hrDevelopmentPlans.status as any, 'in_progress')));
    const pendingPromotions = await db.select({ count: count() }).from(hrPromotionRecommendations).where(and(eq(hrPromotionRecommendations.orgId, orgId), eq(hrPromotionRecommendations.status as any, 'pending')));

    return {
      totalReviews,
      avgRating: Math.round(avgRating * 10) / 10,
      ratingDistribution,
      reviewsByType: byType,
      totalKpis: totalKpis[0]?.count || 0,
      activeKpis: activeKpis[0]?.count || 0,
      activeDevPlans: activeDevPlans[0]?.count || 0,
      pendingPromotions: pendingPromotions[0]?.count || 0,
    };
  } catch (error) { console.error('[PeopleService] getPerformanceAnalytics error:', error); throw error; }
}
