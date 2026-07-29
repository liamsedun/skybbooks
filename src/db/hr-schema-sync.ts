/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auto-generates CREATE TABLE IF NOT EXISTS DDL from Drizzle ORM pgTable
 * definitions for all HR tables that are missing from the startup migration.
 * Called from migrate.ts during startup.
 */
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  hrDepartments, hrDesignations, hrEmployees,
  hrEmployeeDocuments, hrEmergencyContacts,
  hrEmployeeDependants, hrEmployeeEducation,
  hrEmployeeEmploymentHistory, hrEmployeeSkills,
  hrEmployeeCertifications, hrEmployeeMedical,
  hrEmployeeTimeline, hrEmployeeTransfers,
  hrEmployeePromotions, hrEmployeeDisciplinary,
  hrJobOpenings, hrCandidates, hrCandidateApplications,
  hrOnboardingTasks, hrJobRequisitions,
  hrInterviewEvaluations, hrOfferLetters,
  hrBackgroundChecks, hrPreEmploymentDocuments,
  hrEquipmentAssignments, hrOrientationSessions,
  hrProbationReviews,
  hrLeaveTypes, hrLeaveRequests, hrLeaveBalances,
  hrLeavePolicies, hrHolidays, hrCompensatoryLeaves,
  hrLeaveAccrualLogs,
  hrAttendanceRecords, hrShifts, hrTimesheets,
  hrTimesheetEntries, hrShiftAssignments, hrShiftRotations,
  hrShiftRotationAssignees, hrAttendanceExceptions,
  hrOvertimePolicies,
  hrPerformanceReviews, hrReviewSections, hrKpis,
  hrPerformanceCycles, hrDevelopmentPlans,
  hrPromotionRecommendations,
  hrCourses, hrEnrollments, hrPulseSurveys, hrSurveyResponses,
  hrAnnouncements, hrRecognition,
  hrLetterTemplates, hrLetters,
  hrTravelRequests, hrExpenseReports, hrExpenseEntries,
  hrCompensationBands, hrEmployeeCompensation,
  hrBenefits, hrEmployeeBenefits,
  hrAllowances, hrEmployeeAllowances,
  hrBonuses, hrDeductions, hrEmployeeDeductions,
  hrSalaryReviews, hrCompensationHistory,
  hrTasks, hrWorkflowTemplates,
  hrGoalCycles, hrOkrs, hrKeyResults,
  hrOffboardingTasks, hrExitInterviews,
  hrHelpTickets, hrTicketResponses,
  hrApprovalConfigs, hrApprovalRequests,
  hrApprovalStepInstances, hrApprovalDelegations,
  hrApprovalEscalationRules, hrApprovalComments,
  hrSettings, hrPolicies, hrScheduledReports,
  hrWorkflowInstances, hrAutomationRules,
  hrNotifications, hrReminderConfigs,
} from './tenant/tables';

const NAME_SYM = Symbol.for('drizzle:Name');

function getRawDefault(col: AnyPgColumn): string {
  const d = (col as any).default;
  if (d === undefined || d === null) return '';
  const isSql = d.constructor?.name === 'SQL';
  if (isSql) {
    const chunks = d.queryChunks;
    const parts = chunks.map((c: any) => Array.isArray(c.value) ? c.value[0] : String(c.value));
    return ` DEFAULT ${parts.join('')}`;
  }
  if (typeof d === 'boolean') return ` DEFAULT ${d ? 'true' : 'false'}`;
  if (typeof d === 'number') return ` DEFAULT ${d}`;
  if (typeof d === 'string') return ` DEFAULT '${d}'`;
  return ` DEFAULT ${String(d)}`;
}

function getRefTableName(table: any): string {
  return table?.[NAME_SYM] || table?._?.name || 'unknown';
}

function generateCreateTableSQL(table: any): string {
  const cfg = getTableConfig(table);
  const lines: string[] = [];

  for (const col of cfg.columns) {
    const sqlType = col.getSQLType();
    let part = `  ${col.name} ${sqlType}`;
    if (col.primary) {
      part += ' PRIMARY KEY';
    }
    if (!col.primary && col.notNull) part += ' NOT NULL';
    part += getRawDefault(col);
    lines.push(part);
  }

  return `CREATE TABLE IF NOT EXISTS ${cfg.name} (\n${lines.join(',\n')}\n)`;
}

function generateAlterFK(table: any): string[] {
  const cfg = getTableConfig(table);
  const stmts: string[] = [];
  for (const fk of cfg.foreignKeys) {
    const ref = fk.reference();
    const cols = ref.columns.map((c: any) => c.name);
    const ftName = getRefTableName(ref.foreignTable);
    const fkCols = ref.foreignColumns.map((c: any) => c.name);
    let sql = `ALTER TABLE ${cfg.name} ADD CONSTRAINT ${cfg.name}_${cols.join('_')}_fkey FOREIGN KEY (${cols.join(', ')}) REFERENCES ${ftName}(${fkCols.join(', ')})`;
    if (fk.onDelete && fk.onDelete !== 'no action') sql += ` ON DELETE ${fk.onDelete}`;
    if (fk.onUpdate && fk.onUpdate !== 'no action') sql += ` ON UPDATE ${fk.onUpdate}`;
    stmts.push(sql);
  }
  return stmts;
}

function generateIndexSQL(table: any): string[] {
  const cfg = getTableConfig(table);
  const stmts: string[] = [];
  for (const idx of cfg.indexes) {
    const config: any = (idx as any).config || idx;
    const name = config.name;
    const colList = config.columns || [];
    const unique = config.unique || config.isUnique || false;
    const colExprs = colList.map((c: any) => {
      if (typeof c === 'string') return c;
      if (c.expression) return c.expression;
      if (c.name) return c.name;
      return '';
    }).filter(Boolean);
    if (colExprs.length === 0) continue;
    const uq = unique ? 'UNIQUE ' : '';
    stmts.push(`CREATE ${uq}INDEX IF NOT EXISTS ${name} ON ${cfg.name} (${colExprs.join(', ')})`);
  }
  return stmts;
}

const HR_TABLES: any[] = [
  hrDepartments, hrDesignations, hrEmployees,
  hrEmployeeDocuments, hrEmergencyContacts,
  hrEmployeeDependants, hrEmployeeEducation,
  hrEmployeeEmploymentHistory, hrEmployeeSkills,
  hrEmployeeCertifications, hrEmployeeMedical,
  hrEmployeeTimeline, hrEmployeeTransfers,
  hrEmployeePromotions, hrEmployeeDisciplinary,
  hrJobOpenings, hrCandidates, hrCandidateApplications,
  hrOnboardingTasks, hrJobRequisitions,
  hrInterviewEvaluations, hrOfferLetters,
  hrBackgroundChecks, hrPreEmploymentDocuments,
  hrEquipmentAssignments, hrOrientationSessions,
  hrProbationReviews,
  hrLeaveTypes, hrLeaveRequests, hrLeaveBalances,
  hrLeavePolicies, hrHolidays, hrCompensatoryLeaves,
  hrLeaveAccrualLogs,
  hrAttendanceRecords, hrShifts, hrTimesheets,
  hrTimesheetEntries, hrShiftAssignments, hrShiftRotations,
  hrShiftRotationAssignees, hrAttendanceExceptions,
  hrOvertimePolicies,
  hrPerformanceReviews, hrReviewSections, hrKpis,
  hrPerformanceCycles, hrDevelopmentPlans,
  hrPromotionRecommendations,
  hrCourses, hrEnrollments, hrPulseSurveys, hrSurveyResponses,
  hrAnnouncements, hrRecognition,
  hrLetterTemplates, hrLetters,
  hrTravelRequests, hrExpenseReports, hrExpenseEntries,
  hrCompensationBands, hrEmployeeCompensation,
  hrBenefits, hrEmployeeBenefits,
  hrAllowances, hrEmployeeAllowances,
  hrBonuses, hrDeductions, hrEmployeeDeductions,
  hrSalaryReviews, hrCompensationHistory,
  hrTasks, hrWorkflowTemplates,
  hrGoalCycles, hrOkrs, hrKeyResults,
  hrOffboardingTasks, hrExitInterviews,
  hrHelpTickets, hrTicketResponses,
  hrApprovalConfigs, hrApprovalRequests,
  hrApprovalStepInstances, hrApprovalDelegations,
  hrApprovalEscalationRules, hrApprovalComments,
  hrSettings, hrPolicies, hrScheduledReports,
  hrWorkflowInstances, hrAutomationRules,
  hrNotifications, hrReminderConfigs,
];

export async function syncHrSchema(db: any): Promise<void> {
  console.log('[Migration] Syncing HR schema...');

  await db.execute(sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_gender') THEN CREATE TYPE hr_gender AS ENUM ('male','female','other'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_marital_status') THEN CREATE TYPE hr_marital_status AS ENUM ('single','married','divorced','widowed'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_employment_status') THEN CREATE TYPE hr_employment_status AS ENUM ('active','suspended','terminated','resigned','retired'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_contract_type') THEN CREATE TYPE hr_contract_type AS ENUM ('permanent','contract','internship','temporary','probation'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_leave_status') THEN CREATE TYPE hr_leave_status AS ENUM ('pending','approved','rejected','cancelled'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_attendance_status') THEN CREATE TYPE hr_attendance_status AS ENUM ('present','absent','late','half_day','on_leave'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_shift_type') THEN CREATE TYPE hr_shift_type AS ENUM ('morning','afternoon','night','general'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_review_status') THEN CREATE TYPE hr_review_status AS ENUM ('draft','pending_review','completed','cancelled'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_application_status') THEN CREATE TYPE hr_application_status AS ENUM ('new','screened','interviewed','offered','hired','rejected','withdrawn'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_job_status') THEN CREATE TYPE hr_job_status AS ENUM ('draft','open','paused','filled','closed'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_travel_status') THEN CREATE TYPE hr_travel_status AS ENUM ('draft','submitted','approved','declined','cancelled','completed'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_expense_status') THEN CREATE TYPE hr_expense_status AS ENUM ('draft','submitted','approved','reimbursed','declined'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_priority') THEN CREATE TYPE hr_priority AS ENUM ('low','medium','high','urgent'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_approval_status') THEN CREATE TYPE hr_approval_status AS ENUM ('pending','approved','rejected','cancelled'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_ticket_status') THEN CREATE TYPE hr_ticket_status AS ENUM ('open','in_progress','resolved','closed'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_survey_status') THEN CREATE TYPE hr_survey_status AS ENUM ('draft','active','closed'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_okr_type') THEN CREATE TYPE hr_okr_type AS ENUM ('committed','aspirational'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_review_type') THEN CREATE TYPE hr_review_type AS ENUM ('self','manager','peer','360'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_kpi_frequency') THEN CREATE TYPE hr_kpi_frequency AS ENUM ('weekly','monthly','quarterly','yearly'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_dev_plan_status') THEN CREATE TYPE hr_dev_plan_status AS ENUM ('not_started','in_progress','completed','cancelled'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_promotion_status') THEN CREATE TYPE hr_promotion_status AS ENUM ('pending','approved','rejected','cancelled'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_course_level') THEN CREATE TYPE hr_course_level AS ENUM ('beginner','intermediate','advanced'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_course_status') THEN CREATE TYPE hr_course_status AS ENUM ('draft','published','archived'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_letter_type') THEN CREATE TYPE hr_letter_type AS ENUM ('offer_letter','appointment','confirmation','warning','termination','promotion','transfer','resignation_acceptance','experience','other'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_approval_step_status') THEN CREATE TYPE hr_approval_step_status AS ENUM ('pending','in_progress','approved','rejected','sent_back','escalated','skipped'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_workflow_status') THEN CREATE TYPE hr_workflow_status AS ENUM ('pending','running','completed','failed','cancelled'); END IF;
  END $$;`);

  for (const table of HR_TABLES) {
    const { name } = getTableConfig(table);
    const ddl = generateCreateTableSQL(table);
    try {
      await db.execute(sql.raw(ddl));
      console.log(`  [HR] Table ${name}`);
    } catch (err: any) {
      console.warn(`  [HR] Table ${name} skipped: ${err.message}`);
    }
  }

  for (const table of HR_TABLES) {
    for (const fkSql of generateAlterFK(table)) {
      try {
        await db.execute(sql.raw(fkSql));
      } catch {
      }
    }
  }

  for (const table of HR_TABLES) {
    const indexes = generateIndexSQL(table);
    for (const idx of indexes) {
      try {
        await db.execute(sql.raw(idx));
      } catch {
      }
    }
  }

  console.log('[Migration] HR schema sync complete.');
}
