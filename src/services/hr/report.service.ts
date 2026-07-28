import { sql, eq, and, or, desc, asc, count, gte, lte, sum, avg, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrEmployees, hrDepartments, hrDesignations,
  hrLeaveRequests, hrLeaveBalances, hrLeaveTypes,
  hrAttendanceRecords, hrAttendanceExceptions,
  hrTravelRequests, hrExpenseReports, hrExpenseEntries,
  hrPerformanceReviews, hrPerformanceGoals, hrKpiEntries,
  hrDevPlans,
  hrCompensationBands, hrEmployeeCompensation, hrSalaryReviews, hrBonuses, hrBenefits, hrEmployeeBenefits,
  hrCandidateApplications, hrJobOpenings,
  hrCourses, hrEnrollments,
  hrExitInterviews, hrOffboardingTasks,
  hrScheduledReports,
} from '../../db/schema';
import { createAuditLog } from '../audit.service';

export interface ReportFilters { dateFrom?: string; dateTo?: string; departmentId?: string; employeeId?: string; }

// ── Employee Reports ──

export async function getEmployeeReport(orgId: string, filters?: ReportFilters) {
  const conditions: any[] = [eq(hrEmployees.orgId, orgId)];
  if (filters?.departmentId) conditions.push(eq(hrEmployees.departmentId, filters.departmentId));

  const total = await db.select({ count: count() }).from(hrEmployees).where(and(...conditions)).then(r => r[0]?.count || 0);
  const activeCount = await db.select({ count: count() }).from(hrEmployees).where(and(...conditions, eq(hrEmployees.employmentStatus, 'active'))).then(r => r[0]?.count || 0);

  const byDepartment = await db.select({ department: hrDepartments.name, departmentId: hrEmployees.departmentId, count: count() }).from(hrEmployees)
    .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id)).where(and(...conditions)).groupBy(hrEmployees.departmentId, hrDepartments.name);

  const byStatus = await db.select({ status: hrEmployees.employmentStatus, count: count() }).from(hrEmployees)
    .where(and(...conditions)).groupBy(hrEmployees.employmentStatus);

  const byGender = await db.select({ gender: hrEmployees.gender, count: count() }).from(hrEmployees)
    .where(and(...conditions, isNotNull(hrEmployees.gender))).groupBy(hrEmployees.gender);

  const newHires = await db.select({ count: count() }).from(hrEmployees)
    .where(and(...conditions, sql`${hrEmployees.joinDate} >= date_trunc('month', current_date)`)).then(r => r[0]?.count || 0);

  const employees = await db.select().from(hrEmployees).leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
    .where(and(...conditions)).orderBy(hrEmployees.firstName);

  return { total, activeCount, newHires, byDepartment, byStatus, byGender, employees };
}

export async function getEmployeeDetailReport(orgId: string, employeeId: string) {
  const [emp] = await db.select().from(hrEmployees).leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
    .leftJoin(hrDesignations, eq(hrEmployees.designationId, hrDesignations.id))
    .where(and(eq(hrEmployees.id, employeeId), eq(hrEmployees.orgId, orgId)));
  if (!emp) throw new Error('Employee not found');

  const leaveSummary = await db.select({ leaveTypeId: hrLeaveBalances.leaveTypeId, totalDays: hrLeaveBalances.totalDays, usedDays: hrLeaveBalances.usedDays, pendingDays: hrLeaveBalances.pendingDays })
    .from(hrLeaveBalances).where(eq(hrLeaveBalances.employeeId, employeeId));

  const recentAttendance = await db.select().from(hrAttendanceRecords)
    .where(eq(hrAttendanceRecords.employeeId, employeeId)).orderBy(desc(hrAttendanceRecords.date)).limit(30);

  return { employee: emp, leaveSummary, recentAttendance };
}

// ── Leave Reports ──

export async function getLeaveReportData(orgId: string, filters?: ReportFilters) {
  const conditions: any[] = [eq(hrLeaveRequests.orgId, orgId)];
  if (filters?.dateFrom) conditions.push(gte(hrLeaveRequests.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(hrLeaveRequests.createdAt, new Date(filters.dateTo)));
  if (filters?.departmentId) conditions.push(eq(hrEmployees.departmentId, filters.departmentId));

  const totalRequests = await db.select({ count: count() }).from(hrLeaveRequests).where(and(...conditions)).then(r => r[0]?.count || 0);

  const byStatus = await db.select({ status: hrLeaveRequests.status, count: count() }).from(hrLeaveRequests)
    .where(and(...conditions)).groupBy(hrLeaveRequests.status);

  const byType = await db.select({ leaveType: hrLeaveTypes.name, leaveTypeId: hrLeaveRequests.leaveTypeId, count: count() }).from(hrLeaveRequests)
    .leftJoin(hrLeaveTypes, eq(hrLeaveRequests.leaveTypeId, hrLeaveTypes.id)).where(and(...conditions)).groupBy(hrLeaveRequests.leaveTypeId, hrLeaveTypes.name);

  const totalDays = await db.select({ total: sum(hrLeaveRequests.totalDays) }).from(hrLeaveRequests).where(and(...conditions)).then(r => Number(r[0]?.total || 0));

  const monthlyBreakdown = await db.select({ month: sql<string>`to_char(${hrLeaveRequests.createdAt}, 'YYYY-MM')`, count: count(), totalDays: sum(hrLeaveRequests.totalDays) })
    .from(hrLeaveRequests).where(and(...conditions)).groupBy(sql`to_char(${hrLeaveRequests.createdAt}, 'YYYY-MM')`).orderBy(sql`to_char(${hrLeaveRequests.createdAt}, 'YYYY-MM')`);

  return { totalRequests, byStatus, byType, totalDays, monthlyBreakdown };
}

export async function getEmployeeLeaveBalances(orgId: string, employeeId?: string) {
  const conditions: any[] = [eq(hrLeaveBalances.orgId, orgId)];
  if (employeeId) conditions.push(eq(hrLeaveBalances.employeeId, employeeId));
  return await db.select().from(hrLeaveBalances).leftJoin(hrLeaveTypes, eq(hrLeaveBalances.leaveTypeId, hrLeaveTypes.id))
    .where(and(...conditions)).orderBy(hrLeaveTypes.name);
}

// ── Attendance Reports ──

export async function getAttendanceReportData(orgId: string, filters?: ReportFilters) {
  const conditions: any[] = [eq(hrAttendanceRecords.orgId, orgId)];
  if (filters?.dateFrom) conditions.push(gte(hrAttendanceRecords.date, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(hrAttendanceRecords.date, new Date(filters.dateTo)));
  if (filters?.employeeId) conditions.push(eq(hrAttendanceRecords.employeeId, filters.employeeId));
  if (filters?.departmentId) conditions.push(eq(hrEmployees.departmentId, filters.departmentId));

  const total = await db.select({ count: count() }).from(hrAttendanceRecords).where(and(...conditions)).then(r => r[0]?.count || 0);

  const byStatus = await db.select({ status: hrAttendanceRecords.status, count: count() }).from(hrAttendanceRecords)
    .where(and(...conditions)).groupBy(hrAttendanceRecords.status);

  const byEmployee = await db.select({ employeeId: hrAttendanceRecords.employeeId, count: count() }).from(hrAttendanceRecords)
    .where(and(...conditions)).groupBy(hrAttendanceRecords.employeeId).orderBy(desc(count())).limit(20);

  const avgHours = await db.select({ avg: avg(hrAttendanceRecords.totalHours) }).from(hrAttendanceRecords)
    .where(and(...conditions, isNotNull(hrAttendanceRecords.totalHours))).then(r => Number(r[0]?.avg || 0));

  return { total, byStatus, byEmployee, avgHours: Math.round(avgHours * 100) / 100 };
}

// ── Performance Reports ──

export async function getPerformanceReportData(orgId: string, filters?: ReportFilters) {
  const conditions: any[] = [eq(hrPerformanceReviews.orgId, orgId)];
  if (filters?.dateFrom) conditions.push(gte(hrPerformanceReviews.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(hrPerformanceReviews.createdAt, new Date(filters.dateTo)));

  const totalReviews = await db.select({ count: count() }).from(hrPerformanceReviews).where(and(...conditions)).then(r => r[0]?.count || 0);

  const byStatus = await db.select({ status: hrPerformanceReviews.status, count: count() }).from(hrPerformanceReviews)
    .where(and(...conditions)).groupBy(hrPerformanceReviews.status);

  const avgRating = await db.select({ avg: avg(hrPerformanceReviews.overallRating) }).from(hrPerformanceReviews)
    .where(and(...conditions, isNotNull(hrPerformanceReviews.overallRating))).then(r => Number(r[0]?.avg || 0));

  const activeGoals = await db.select({ count: count() }).from(hrPerformanceGoals)
    .where(and(eq(hrPerformanceGoals.orgId, orgId), eq(hrPerformanceGoals.status, 'active'))).then(r => r[0]?.count || 0);

  const activeDevPlans = await db.select({ count: count() }).from(hrDevPlans)
    .where(and(eq(hrDevPlans.orgId, orgId), eq(hrDevPlans.status, 'in_progress'))).then(r => r[0]?.count || 0);

  return { totalReviews, byStatus, avgRating: Math.round(avgRating * 10) / 10, activeGoals, activeDevPlans };
}

// ── Travel Reports ──

export async function getTravelReportData(orgId: string, filters?: ReportFilters) {
  const conditions: any[] = [eq(hrTravelRequests.orgId, orgId)];
  if (filters?.dateFrom) conditions.push(gte(hrTravelRequests.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(hrTravelRequests.createdAt, new Date(filters.dateTo)));
  if (filters?.departmentId) conditions.push(eq(hrEmployees.departmentId, filters.departmentId));

  const totalRequests = await db.select({ count: count() }).from(hrTravelRequests).where(and(...conditions)).then(r => r[0]?.count || 0);
  const byStatus = await db.select({ status: hrTravelRequests.status, count: count() }).from(hrTravelRequests)
    .where(and(...conditions)).groupBy(hrTravelRequests.status);
  const totalCost = await db.select({ total: sum(hrExpenseReports.totalAmount) }).from(hrExpenseReports)
    .where(and(eq(hrExpenseReports.orgId, orgId))).then(r => Number(r[0]?.total || 0));

  return { totalRequests, byStatus, totalCost };
}

// ── Compensation Reports ──

export async function getCompensationReportData(orgId: string, filters?: ReportFilters) {
  const bandCount = await db.select({ count: count() }).from(hrCompensationBands).where(eq(hrCompensationBands.orgId, orgId)).then(r => r[0]?.count || 0);
  const empCount = await db.select({ count: count() }).from(hrEmployeeCompensation).where(eq(hrEmployeeCompensation.orgId, orgId)).then(r => r[0]?.count || 0);
  const totalSalary = await db.select({ total: sum(hrEmployeeCompensation.annualSalary) }).from(hrEmployeeCompensation)
    .where(eq(hrEmployeeCompensation.orgId, orgId)).then(r => Number(r[0]?.total || 0));
  const pendingReviews = await db.select({ count: count() }).from(hrSalaryReviews)
    .where(and(eq(hrSalaryReviews.orgId, orgId), eq(hrSalaryReviews.status, 'pending'))).then(r => r[0]?.count || 0);
  const approvedBonuses = await db.select({ count: count() }).from(hrBonuses)
    .where(and(eq(hrBonuses.orgId, orgId), eq(hrBonuses.status, 'approved'))).then(r => r[0]?.count || 0);
  const benefitsCount = await db.select({ count: count() }).from(hrEmployeeBenefits).where(eq(hrEmployeeBenefits.orgId, orgId)).then(r => r[0]?.count || 0);
  const benefitsCost = await db.select({ total: sum(hrEmployeeBenefits.employeeCost) }).from(hrEmployeeBenefits)
    .where(eq(hrEmployeeBenefits.orgId, orgId)).then(r => Number(r[0]?.total || 0));

  const salaryByBand = await db.select({ bandId: hrEmployeeCompensation.bandId, total: sum(hrEmployeeCompensation.annualSalary), count: count() })
    .from(hrEmployeeCompensation).where(eq(hrEmployeeCompensation.orgId, orgId)).groupBy(hrEmployeeCompensation.bandId);

  return { bandCount, empCount, totalSalary, pendingReviews, approvedBonuses, benefitsCount, benefitsCost, salaryByBand };
}

// ── Turnover Reports ──

export async function getTurnoverReportData(orgId: string, filters?: ReportFilters) {
  const conditions: any[] = [eq(hrEmployees.orgId, orgId)];
  if (filters?.dateFrom) conditions.push(gte(hrEmployees.exitDate, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(hrEmployees.exitDate, new Date(filters.dateTo)));

  const totalLeavers = await db.select({ count: count() }).from(hrEmployees)
    .where(and(...conditions, eq(hrEmployees.employmentStatus, 'inactive'))).then(r => r[0]?.count || 0);
  const voluntary = await db.select({ count: count() }).from(hrExitInterviews)
    .where(eq(hrExitInterviews.orgId, orgId)).then(r => r[0]?.count || 0);
  const totalActive = await db.select({ count: count() }).from(hrEmployees)
    .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'))).then(r => r[0]?.count || 0);
  const turnoverRate = totalActive ? Math.round((totalLeavers / (totalActive + totalLeavers)) * 100 * 10) / 10 : 0;

  const byDepartment = await db.select({ department: hrDepartments.name, count: count() }).from(hrEmployees)
    .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
    .where(and(...conditions, eq(hrEmployees.employmentStatus, 'inactive'))).groupBy(hrDepartments.name);

  const byReason = await db.select({ reason: hrExitInterviews.reason, count: count() }).from(hrExitInterviews)
    .where(eq(hrExitInterviews.orgId, orgId)).groupBy(hrExitInterviews.reason);

  return { totalLeavers, voluntary: voluntary || 0, involuntary: (totalLeavers - voluntary) || 0, turnoverRate, byDepartment, byReason };
}

// ── Recruitment Reports ──

export async function getRecruitmentReportData(orgId: string, filters?: ReportFilters) {
  const openPositions = await db.select({ count: count() }).from(hrJobOpenings).where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.status, 'open'))).then(r => r[0]?.count || 0);
  const totalCandidates = await db.select({ count: count() }).from(hrCandidateApplications).where(eq(hrCandidateApplications.orgId, orgId)).then(r => r[0]?.count || 0);
  const hired = await db.select({ count: count() }).from(hrCandidateApplications).where(and(eq(hrCandidateApplications.orgId, orgId), eq(hrCandidateApplications.status, 'hired'))).then(r => r[0]?.count || 0);

  const funnel = await db.select({ status: hrCandidateApplications.status, count: count() }).from(hrCandidateApplications)
    .where(eq(hrCandidateApplications.orgId, orgId)).groupBy(hrCandidateApplications.status);

  const totalFunnel = funnel.reduce((s, r) => s + Number(r.count), 0);
  const funnelWithRate = funnel.map((r, i) => ({
    stage: r.status, count: Number(r.count),
    conversionRate: i === 0 ? 100 : totalFunnel ? Math.round((Number(r.count) / Number(funnel[i - 1]?.count || 1)) * 100 * 10) / 10 : 0,
  }));

  return { openPositions, totalCandidates, hired, funnel: funnelWithRate };
}

// ── KPI Dashboard ──

export async function getKpiDashboard(orgId: string) {
  const totalEmployees = await db.select({ count: count() }).from(hrEmployees).where(eq(hrEmployees.orgId, orgId)).then(r => r[0]?.count || 0);
  const activeEmployees = await db.select({ count: count() }).from(hrEmployees).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.employmentStatus, 'active'))).then(r => r[0]?.count || 0);
  const newHires = await db.select({ count: count() }).from(hrEmployees).where(and(eq(hrEmployees.orgId, orgId), sql`${hrEmployees.joinDate} >= date_trunc('month', current_date)`)).then(r => r[0]?.count || 0);
  const departments = await db.select({ count: count() }).from(hrDepartments).where(eq(hrDepartments.orgId, orgId)).then(r => r[0]?.count || 0);

  const pendingLeave = await db.select({ count: count() }).from(hrLeaveRequests).where(and(eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.status, 'pending'))).then(r => r[0]?.count || 0);
  const pendingTravel = await db.select({ count: count() }).from(hrTravelRequests).where(and(eq(hrTravelRequests.orgId, orgId), eq(hrTravelRequests.status, 'submitted'))).then(r => r[0]?.count || 0);
  const pendingPerformance = await db.select({ count: count() }).from(hrPerformanceReviews).where(and(eq(hrPerformanceReviews.orgId, orgId), eq(hrPerformanceReviews.status, 'pending_review'))).then(r => r[0]?.count || 0);
  const pendingSalary = await db.select({ count: count() }).from(hrSalaryReviews).where(and(eq(hrSalaryReviews.orgId, orgId), eq(hrSalaryReviews.status, 'pending'))).then(r => r[0]?.count || 0);
  const openPositions = await db.select({ count: count() }).from(hrJobOpenings).where(and(eq(hrJobOpenings.orgId, orgId), eq(hrJobOpenings.status, 'open'))).then(r => r[0]?.count || 0);
  const activeCourses = await db.select({ count: count() }).from(hrCourses).where(and(eq(hrCourses.orgId, orgId), eq(hrCourses.status, 'published'))).then(r => r[0]?.count || 0);

  const attendanceToday = await db.select({ count: count() }).from(hrAttendanceRecords)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(sql`${hrAttendanceRecords.date}::date`, sql`current_date`))).then(r => r[0]?.count || 0);

  const avgHours = await db.select({ avg: avg(hrAttendanceRecords.totalHours) }).from(hrAttendanceRecords)
    .where(and(eq(hrAttendanceRecords.orgId, orgId), eq(sql`${hrAttendanceRecords.date}::date`, sql`current_date`), isNotNull(hrAttendanceRecords.totalHours)))
    .then(r => Number(r[0]?.avg || 0));

  return {
    totalEmployees, activeEmployees, newHires, departments,
    pendingLeave, pendingTravel, pendingPerformance, pendingSalary,
    openPositions, activeCourses, attendanceToday,
    avgHours: Math.round(avgHours * 100) / 100,
  };
}

// ── CSV Export Data ──

export async function getExportData(orgId: string, reportType: string, filters?: ReportFilters): Promise<{ headers: string[]; rows: string[][]; title: string }> {
  switch (reportType) {
    case 'employees': {
      const employees = await db.select().from(hrEmployees).leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id)).where(eq(hrEmployees.orgId, orgId)).orderBy(hrEmployees.firstName);
      return {
        title: 'Employee Report', headers: ['Employee ID', 'Name', 'Email', 'Department', 'Designation', 'Status', 'Join Date', 'Phone'],
        rows: employees.map(e => [
          e.hr_employees.employeeCode || e.hr_employees.id, `${e.hr_employees.firstName} ${e.hr_employees.lastName}`,
          e.hr_employees.email || '', e.hr_departments?.name || '', e.hr_employees.designationId || '',
          e.hr_employees.employmentStatus || '', e.hr_employees.joinDate?.toLocaleDateString() || '', e.hr_employees.phone || '',
        ]),
      };
    }
    case 'leave': {
      const data = await getLeaveReportData(orgId, filters);
      return {
        title: 'Leave Report', headers: ['Status', 'Count', 'Days'],
        rows: data.byStatus.map(r => [r.status, String(r.count), '']).concat(data.byType.map(r => [r.leaveType || '', String(r.count), ''])),
      };
    }
    case 'attendance': {
      const data = await getAttendanceReportData(orgId, filters);
      return {
        title: 'Attendance Report', headers: ['Status', 'Count'],
        rows: data.byStatus.map(r => [r.status, String(r.count)]),
      };
    }
    case 'performance': {
      const data = await getPerformanceReportData(orgId, filters);
      return {
        title: 'Performance Report', headers: ['Metric', 'Value'],
        rows: [
          ['Total Reviews', String(data.totalReviews)],
          ['Avg Rating', String(data.avgRating)],
          ['Active Goals', String(data.activeGoals)],
          ['Active Dev Plans', String(data.activeDevPlans)],
          ...data.byStatus.map(r => [`Status: ${r.status}`, String(r.count)]),
        ],
      };
    }
    case 'compensation': {
      const data = await getCompensationReportData(orgId, filters);
      return {
        title: 'Compensation Report', headers: ['Metric', 'Value'],
        rows: [
          ['Pay Grades', String(data.bandCount)],
          ['Employees w/ Compensation', String(data.empCount)],
          ['Total Salary', String(data.totalSalary)],
          ['Pending Reviews', String(data.pendingReviews)],
          ['Approved Bonuses', String(data.approvedBonuses)],
          ['Benefits Cost', String(data.benefitsCost)],
        ],
      };
    }
    case 'turnover': {
      const data = await getTurnoverReportData(orgId, filters);
      return {
        title: 'Turnover Report', headers: ['Department', 'Leavers'],
        rows: data.byDepartment.map(r => [r.department || '', String(r.count)]).concat([['Rate (%)', String(data.turnoverRate)]]),
      };
    }
    case 'recruitment': {
      const data = await getRecruitmentReportData(orgId, filters);
      return {
        title: 'Recruitment Report', headers: ['Stage', 'Count', 'Conversion (%)'],
        rows: data.funnel.map(r => [r.stage, String(r.count), String(r.conversionRate)]),
      };
    }
    case 'travel': {
      const data = await getTravelReportData(orgId, filters);
      return {
        title: 'Travel Report', headers: ['Status', 'Count'],
        rows: data.byStatus.map(r => [r.status, String(r.count)]),
      };
    }
    default: {
      const kpi = await getKpiDashboard(orgId);
      return {
        title: 'HR KPI Dashboard', headers: ['KPI', 'Value'],
        rows: [
          ['Total Employees', String(kpi.totalEmployees)],
          ['Active Employees', String(kpi.activeEmployees)],
          ['New Hires This Month', String(kpi.newHires)],
          ['Departments', String(kpi.departments)],
          ['Pending Leave', String(kpi.pendingLeave)],
          ['Pending Travel', String(kpi.pendingTravel)],
          ['Open Positions', String(kpi.openPositions)],
          ['Attendance Today', String(kpi.attendanceToday)],
        ],
      };
    }
  }
}

// ── Scheduled Reports ──

export async function getScheduledReports(orgId: string) {
  return await db.select().from(hrScheduledReports).where(eq(hrScheduledReports.orgId, orgId)).orderBy(hrScheduledReports.createdAt);
}

export async function createScheduledReport(orgId: string, data: any) {
  const [row] = await db.insert(hrScheduledReports).values({
    orgId, name: data.name, reportType: data.reportType, frequency: data.frequency,
    recipients: data.recipients || [], format: data.format || 'csv',
    filters: data.filters || {}, isActive: data.isActive !== false,
  }).returning();
  return row;
}

export async function deleteScheduledReport(orgId: string, id: string) {
  const [row] = await db.delete(hrScheduledReports).where(and(eq(hrScheduledReports.id, id), eq(hrScheduledReports.orgId, orgId))).returning();
  if (!row) throw new Error('Scheduled report not found');
  return row;
}

// ── Drill-down ──

export async function getDrillDownData(orgId: string, reportType: string, groupKey: string, groupValue: string, filters?: ReportFilters): Promise<any[]> {
  switch (reportType) {
    case 'attendance': {
      const conditions: any[] = [eq(hrAttendanceRecords.status, groupValue), eq(hrAttendanceRecords.orgId, orgId)];
      if (filters?.dateFrom) conditions.push(gte(hrAttendanceRecords.date, new Date(filters.dateFrom)));
      if (filters?.dateTo) conditions.push(lte(hrAttendanceRecords.date, new Date(filters.dateTo)));
      const rows = await db.select().from(hrAttendanceRecords).leftJoin(hrEmployees, eq(hrAttendanceRecords.employeeId, hrEmployees.id))
        .where(and(...conditions)).orderBy(desc(hrAttendanceRecords.date)).limit(100);
      return rows.map(r => ({ date: r.hr_attendance_records.date, employee: `${r.hr_employees?.firstName || ''} ${r.hr_employees?.lastName || ''}`.trim(), status: r.hr_attendance_records.status, checkIn: r.hr_attendance_records.checkIn, checkOut: r.hr_attendance_records.checkOut }));
    }
    case 'leave': {
      const conditions: any[] = [eq(hrLeaveRequests.orgId, orgId), eq(hrLeaveRequests.status, groupValue)];
      if (filters?.dateFrom) conditions.push(gte(hrLeaveRequests.createdAt, new Date(filters.dateFrom)));
      if (filters?.dateTo) conditions.push(lte(hrLeaveRequests.createdAt, new Date(filters.dateTo)));
      const rows = await db.select().from(hrLeaveRequests).leftJoin(hrEmployees, eq(hrLeaveRequests.employeeId, hrEmployees.id))
        .leftJoin(hrLeaveTypes, eq(hrLeaveRequests.leaveTypeId, hrLeaveTypes.id))
        .where(and(...conditions)).orderBy(desc(hrLeaveRequests.createdAt)).limit(100);
      return rows.map(r => ({ employee: `${r.hr_employees?.firstName || ''} ${r.hr_employees?.lastName || ''}`.trim(), leaveType: r.hr_leave_types?.name || '', days: r.hr_leave_requests.totalDays, status: r.hr_leave_requests.status, createdAt: r.hr_leave_requests.createdAt }));
    }
    case 'department': {
      const rows = await db.select().from(hrEmployees).leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
        .leftJoin(hrDesignations, eq(hrEmployees.designationId, hrDesignations.id))
        .where(and(eq(hrEmployees.orgId, orgId), eq(hrDepartments.name, groupValue))).orderBy(hrEmployees.firstName);
      return rows.map(r => ({ name: `${r.hr_employees.firstName} ${r.hr_employees.lastName}`, email: r.hr_employees.email || '', department: r.hr_departments?.name || '', designation: r.hr_designations?.title || '', status: r.hr_employees.employmentStatus || '' }));
    }
    default: return [];
  }
}
