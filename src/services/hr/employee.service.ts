import { sql, eq, and, or, like, desc, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  hrDepartments, hrDesignations, hrEmployees,
  hrEmployeeDocuments, hrEmergencyContacts,
  hrOffboardingTasks, hrExitInterviews,
  hrEmployeeDependants, hrEmployeeEducation,
  hrEmployeeEmploymentHistory, hrEmployeeSkills,
  hrEmployeeCertifications, hrEmployeeMedical,
  hrEmployeeTimeline, hrEmployeeTransfers,
  hrEmployeePromotions, hrEmployeeDisciplinary,
  hrEmployeeCompensation,
} from '../../db/schema';
import { createAuditLog } from '../audit.service';
import { dispatchEvent } from './workflow.service';

// ── Departments ──

export async function getDepartments(orgId: string) {
  try {
    return await db.select().from(hrDepartments)
      .where(eq(hrDepartments.orgId, orgId))
      .orderBy(hrDepartments.name);
  } catch (err) {
    console.error('[EmployeeService] getDepartments error:', err);
    throw err;
  }
}

export async function getDepartment(orgId: string, deptId: string) {
  try {
    const [row] = await db.select().from(hrDepartments)
      .where(and(eq(hrDepartments.orgId, orgId), eq(hrDepartments.id, deptId)))
      .limit(1);
    return row || null;
  } catch (err) {
    console.error('[EmployeeService] getDepartment error:', err);
    throw err;
  }
}

export async function createDepartment(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrDepartments)
      .values({ ...dbData, orgId } as any)
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'create',
      entityType: 'hr_department',
      entityId: row.id,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] createDepartment error:', err);
    throw err;
  }
}

export async function updateDepartment(orgId: string, deptId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [old] = await db.select().from(hrDepartments)
      .where(and(eq(hrDepartments.orgId, orgId), eq(hrDepartments.id, deptId)))
      .limit(1);
    if (!old) return null;
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrDepartments)
      .set({ ...dbData, updatedAt: new Date() } as any)
      .where(and(eq(hrDepartments.orgId, orgId), eq(hrDepartments.id, deptId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'update',
      entityType: 'hr_department',
      entityId: deptId,
      oldValues: old,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] updateDepartment error:', err);
    throw err;
  }
}

export async function deleteDepartment(orgId: string, deptId: string) {
  try {
    const [old] = await db.select().from(hrDepartments)
      .where(and(eq(hrDepartments.orgId, orgId), eq(hrDepartments.id, deptId)))
      .limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrDepartments)
      .where(and(eq(hrDepartments.orgId, orgId), eq(hrDepartments.id, deptId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'hr_department',
      entityId: deptId,
      oldValues: old,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] deleteDepartment error:', err);
    throw err;
  }
}

// ── Designations ──

export async function getDesignations(orgId: string) {
  try {
    return await db.select({
      id: hrDesignations.id,
      orgId: hrDesignations.orgId,
      title: hrDesignations.title,
      departmentId: hrDesignations.departmentId,
      departmentName: hrDepartments.name,
      description: hrDesignations.description,
      rank: hrDesignations.rank,
      isActive: hrDesignations.isActive,
      createdAt: hrDesignations.createdAt,
    }).from(hrDesignations)
      .leftJoin(hrDepartments, eq(hrDesignations.departmentId, hrDepartments.id))
      .where(eq(hrDesignations.orgId, orgId))
      .orderBy(hrDesignations.title);
  } catch (err) {
    console.error('[EmployeeService] getDesignations error:', err);
    throw err;
  }
}

export async function getDesignation(orgId: string, desigId: string) {
  try {
    const [row] = await db.select({
      id: hrDesignations.id,
      orgId: hrDesignations.orgId,
      title: hrDesignations.title,
      departmentId: hrDesignations.departmentId,
      departmentName: hrDepartments.name,
      description: hrDesignations.description,
      rank: hrDesignations.rank,
      isActive: hrDesignations.isActive,
      createdAt: hrDesignations.createdAt,
    }).from(hrDesignations)
      .leftJoin(hrDepartments, eq(hrDesignations.departmentId, hrDepartments.id))
      .where(and(eq(hrDesignations.orgId, orgId), eq(hrDesignations.id, desigId)))
      .limit(1);
    return row || null;
  } catch (err) {
    console.error('[EmployeeService] getDesignation error:', err);
    throw err;
  }
}

export async function createDesignation(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrDesignations)
      .values({ ...dbData, orgId } as any)
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'create',
      entityType: 'hr_designation',
      entityId: row.id,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] createDesignation error:', err);
    throw err;
  }
}

export async function updateDesignation(orgId: string, desigId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [old] = await db.select().from(hrDesignations)
      .where(and(eq(hrDesignations.orgId, orgId), eq(hrDesignations.id, desigId)))
      .limit(1);
    if (!old) return null;
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrDesignations)
      .set(dbData as any)
      .where(and(eq(hrDesignations.orgId, orgId), eq(hrDesignations.id, desigId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'update',
      entityType: 'hr_designation',
      entityId: desigId,
      oldValues: old,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] updateDesignation error:', err);
    throw err;
  }
}

export async function deleteDesignation(orgId: string, desigId: string) {
  try {
    const [old] = await db.select().from(hrDesignations)
      .where(and(eq(hrDesignations.orgId, orgId), eq(hrDesignations.id, desigId)))
      .limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrDesignations)
      .where(and(eq(hrDesignations.orgId, orgId), eq(hrDesignations.id, desigId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'hr_designation',
      entityId: desigId,
      oldValues: old,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] deleteDesignation error:', err);
    throw err;
  }
}

// ── Employees ──

export interface EmployeeFilters {
  departmentId?: string;
  designationId?: string;
  employmentStatus?: string;
  isActive?: boolean;
  search?: string;
}

export async function getEmployees(orgId: string, filters?: EmployeeFilters) {
  try {
    const conditions: any[] = [eq(hrEmployees.orgId, orgId)];

    if (filters?.departmentId) {
      conditions.push(eq(hrEmployees.departmentId, filters.departmentId));
    }
    if (filters?.designationId) {
      conditions.push(eq(hrEmployees.designationId, filters.designationId));
    }
    if (filters?.employmentStatus) {
      conditions.push(eq(hrEmployees.employmentStatus, filters.employmentStatus as any));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(hrEmployees.isActive, filters.isActive));
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          like(hrEmployees.firstName, term),
          like(hrEmployees.lastName, term),
          like(hrEmployees.email, term),
        )
      );
    }

    return await db.select({
      id: hrEmployees.id,
      orgId: hrEmployees.orgId,
      employeeCode: hrEmployees.employeeCode,
      firstName: hrEmployees.firstName,
      lastName: hrEmployees.lastName,
      otherNames: hrEmployees.otherNames,
      email: hrEmployees.email,
      phone: hrEmployees.phone,
      gender: hrEmployees.gender,
      dateOfBirth: hrEmployees.dateOfBirth,
      maritalStatus: hrEmployees.maritalStatus,
      address: hrEmployees.address,
      city: hrEmployees.city,
      state: hrEmployees.state,
      nationality: hrEmployees.nationality,
      photoUrl: hrEmployees.photoUrl,
      departmentId: hrEmployees.departmentId,
      departmentName: hrDepartments.name,
      designationId: hrEmployees.designationId,
      designationTitle: hrDesignations.title,
      employmentStatus: hrEmployees.employmentStatus,
      contractType: hrEmployees.contractType,
      joinDate: hrEmployees.joinDate,
      confirmDate: hrEmployees.confirmDate,
      contractEndDate: hrEmployees.contractEndDate,
      exitDate: hrEmployees.exitDate,
      exitReason: hrEmployees.exitReason,
      supervisorId: hrEmployees.supervisorId,
      userId: hrEmployees.userId,
      bankName: hrEmployees.bankName,
      bankAccountName: hrEmployees.bankAccountName,
      bankAccountNumber: hrEmployees.bankAccountNumber,
      tin: hrEmployees.tin,
      nssf: hrEmployees.nssf,
      nhif: hrEmployees.nhif,
      isActive: hrEmployees.isActive,
      createdAt: hrEmployees.createdAt,
      updatedAt: hrEmployees.updatedAt,
    }).from(hrEmployees)
      .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
      .leftJoin(hrDesignations, eq(hrEmployees.designationId, hrDesignations.id))
      .where(and(...conditions))
      .orderBy(desc(hrEmployees.createdAt));
  } catch (err) {
    console.error('[EmployeeService] getEmployees error:', err);
    throw err;
  }
}

export async function getEmployee(orgId: string, empId: string) {
  try {
    const [row] = await db.select({
      id: hrEmployees.id,
      orgId: hrEmployees.orgId,
      employeeCode: hrEmployees.employeeCode,
      firstName: hrEmployees.firstName,
      lastName: hrEmployees.lastName,
      otherNames: hrEmployees.otherNames,
      email: hrEmployees.email,
      phone: hrEmployees.phone,
      gender: hrEmployees.gender,
      dateOfBirth: hrEmployees.dateOfBirth,
      maritalStatus: hrEmployees.maritalStatus,
      address: hrEmployees.address,
      city: hrEmployees.city,
      state: hrEmployees.state,
      nationality: hrEmployees.nationality,
      photoUrl: hrEmployees.photoUrl,
      departmentId: hrEmployees.departmentId,
      departmentName: hrDepartments.name,
      designationId: hrEmployees.designationId,
      designationTitle: hrDesignations.title,
      employmentStatus: hrEmployees.employmentStatus,
      contractType: hrEmployees.contractType,
      joinDate: hrEmployees.joinDate,
      confirmDate: hrEmployees.confirmDate,
      contractEndDate: hrEmployees.contractEndDate,
      exitDate: hrEmployees.exitDate,
      exitReason: hrEmployees.exitReason,
      supervisorId: hrEmployees.supervisorId,
      userId: hrEmployees.userId,
      bankName: hrEmployees.bankName,
      bankAccountName: hrEmployees.bankAccountName,
      bankAccountNumber: hrEmployees.bankAccountNumber,
      tin: hrEmployees.tin,
      nssf: hrEmployees.nssf,
      nhif: hrEmployees.nhif,
      isActive: hrEmployees.isActive,
      createdAt: hrEmployees.createdAt,
      updatedAt: hrEmployees.updatedAt,
    }).from(hrEmployees)
      .leftJoin(hrDepartments, eq(hrEmployees.departmentId, hrDepartments.id))
      .leftJoin(hrDesignations, eq(hrEmployees.designationId, hrDesignations.id))
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId)))
      .limit(1);
    return row || null;
  } catch (err) {
    console.error('[EmployeeService] getEmployee error:', err);
    throw err;
  }
}

export async function createEmployee(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    let dbData = { ...(data || {}) };
    if (!dbData.employeeCode) {
      dbData.employeeCode = await generateEmployeeCode(orgId);
    }
    const [row] = await db.insert(hrEmployees)
      .values({ ...dbData, orgId } as any)
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'create',
      entityType: 'hr_employee',
      entityId: row.id,
      newValues: row,
    });
    try { await dispatchEvent(orgId, 'employee.created', row.id, { firstName: data.firstName, lastName: data.lastName, email: data.email, departmentId: data.departmentId, designationId: data.designationId, joinDate: data.joinDate, employmentType: data.employmentType }, userId); } catch (e) { console.error('[WF] dispatch employee.created error:', e); }
    try { const { syncHrEmployeeToPayroll } = await import('./integration.service'); await syncHrEmployeeToPayroll(orgId, row.id, auditUserId); } catch (e) { console.error('[INT] payroll sync error:', e); }
    try { const { createOnboardingTasks } = await import('./integration.service'); await createOnboardingTasks(orgId, row.id, data.departmentId, auditUserId); } catch (e) { console.error('[INT] onboarding tasks error:', e); }
    return row;
  } catch (err) {
    console.error('[EmployeeService] createEmployee error:', err);
    throw err;
  }
}

export async function updateEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [old] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId)))
      .limit(1);
    if (!old) return null;
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrEmployees)
      .set({ ...dbData, updatedAt: new Date() } as any)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'update',
      entityType: 'hr_employee',
      entityId: empId,
      oldValues: old,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] updateEmployee error:', err);
    throw err;
  }
}

export async function deleteEmployee(orgId: string, empId: string) {
  try {
    const [old] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId)))
      .limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'hr_employee',
      entityId: empId,
      oldValues: old,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] deleteEmployee error:', err);
    throw err;
  }
}

export async function generateEmployeeCode(orgId: string): Promise<string> {
  try {
    const [result] = await db.select({ count: count() }).from(hrEmployees)
      .where(eq(hrEmployees.orgId, orgId));
    const year = new Date().getFullYear();
    const next = (result?.count || 0) + 1;
    return `EMP-${year}-${String(next).padStart(4, '0')}`;
  } catch (err) {
    console.error('[EmployeeService] generateEmployeeCode error:', err);
    throw err;
  }
}

// ── Employee Documents ──

export async function getEmployeeDocuments(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeDocuments)
      .where(and(
        eq(hrEmployeeDocuments.orgId, orgId),
        eq(hrEmployeeDocuments.employeeId, empId),
      ))
      .orderBy(desc(hrEmployeeDocuments.createdAt));
  } catch (err) {
    console.error('[EmployeeService] getEmployeeDocuments error:', err);
    throw err;
  }
}

export async function createEmployeeDocument(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmployeeDocuments)
      .values({ ...dbData, orgId } as any)
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'create',
      entityType: 'hr_employee_document',
      entityId: row.id,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] createEmployeeDocument error:', err);
    throw err;
  }
}

export async function deleteEmployeeDocument(orgId: string, docId: string) {
  try {
    const [old] = await db.select().from(hrEmployeeDocuments)
      .where(and(eq(hrEmployeeDocuments.orgId, orgId), eq(hrEmployeeDocuments.id, docId)))
      .limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrEmployeeDocuments)
      .where(and(eq(hrEmployeeDocuments.orgId, orgId), eq(hrEmployeeDocuments.id, docId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'hr_employee_document',
      entityId: docId,
      oldValues: old,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] deleteEmployeeDocument error:', err);
    throw err;
  }
}

// ── Emergency Contacts ──

export async function getEmergencyContacts(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmergencyContacts)
      .where(and(
        eq(hrEmergencyContacts.orgId, orgId),
        eq(hrEmergencyContacts.employeeId, empId),
      ))
      .orderBy(desc(hrEmergencyContacts.createdAt));
  } catch (err) {
    console.error('[EmployeeService] getEmergencyContacts error:', err);
    throw err;
  }
}

export async function createEmergencyContact(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmergencyContacts)
      .values({ ...dbData, orgId } as any)
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'create',
      entityType: 'hr_emergency_contact',
      entityId: row.id,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] createEmergencyContact error:', err);
    throw err;
  }
}

export async function updateEmergencyContact(orgId: string, contactId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [old] = await db.select().from(hrEmergencyContacts)
      .where(and(eq(hrEmergencyContacts.orgId, orgId), eq(hrEmergencyContacts.id, contactId)))
      .limit(1);
    if (!old) return null;
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrEmergencyContacts)
      .set(dbData as any)
      .where(and(eq(hrEmergencyContacts.orgId, orgId), eq(hrEmergencyContacts.id, contactId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'update',
      entityType: 'hr_emergency_contact',
      entityId: contactId,
      oldValues: old,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] updateEmergencyContact error:', err);
    throw err;
  }
}

export async function deleteEmergencyContact(orgId: string, contactId: string) {
  try {
    const [old] = await db.select().from(hrEmergencyContacts)
      .where(and(eq(hrEmergencyContacts.orgId, orgId), eq(hrEmergencyContacts.id, contactId)))
      .limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrEmergencyContacts)
      .where(and(eq(hrEmergencyContacts.orgId, orgId), eq(hrEmergencyContacts.id, contactId)))
      .returning();
    await createAuditLog({
      orgId,
      userId: 'system',
      action: 'delete',
      entityType: 'hr_emergency_contact',
      entityId: contactId,
      oldValues: old,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] deleteEmergencyContact error:', err);
    throw err;
  }
}

// ── Offboarding ──

export async function getOffboardingTasks(orgId: string, empId: string) {
  try {
    return await db.select().from(hrOffboardingTasks)
      .where(and(
        eq(hrOffboardingTasks.orgId, orgId),
        eq(hrOffboardingTasks.employeeId, empId),
      ))
      .orderBy(desc(hrOffboardingTasks.createdAt));
  } catch (err) {
    console.error('[EmployeeService] getOffboardingTasks error:', err);
    throw err;
  }
}

export async function createOffboardingTask(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrOffboardingTasks)
      .values({ ...dbData, orgId } as any)
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'create',
      entityType: 'hr_offboarding_task',
      entityId: row.id,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] createOffboardingTask error:', err);
    throw err;
  }
}

export async function completeOffboardingTask(orgId: string, taskId: string) {
  try {
    const [row] = await db.update(hrOffboardingTasks)
      .set({ isCompleted: true, completedAt: new Date() } as any)
      .where(and(eq(hrOffboardingTasks.orgId, orgId), eq(hrOffboardingTasks.id, taskId)))
      .returning();
    return row || null;
  } catch (err) {
    console.error('[EmployeeService] completeOffboardingTask error:', err);
    throw err;
  }
}

// ── Exit Interviews ──

export async function getExitInterviews(orgId: string) {
  try {
    return await db.select().from(hrExitInterviews)
      .where(eq(hrExitInterviews.orgId, orgId))
      .orderBy(desc(hrExitInterviews.createdAt));
  } catch (err) {
    console.error('[EmployeeService] getExitInterviews error:', err);
    throw err;
  }
}

export async function getExitInterview(orgId: string, empId: string) {
  try {
    const [row] = await db.select().from(hrExitInterviews)
      .where(and(
        eq(hrExitInterviews.orgId, orgId),
        eq(hrExitInterviews.employeeId, empId),
      ))
      .limit(1);
    return row || null;
  } catch (err) {
    console.error('[EmployeeService] getExitInterview error:', err);
    throw err;
  }
}

export async function createExitInterview(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrExitInterviews)
      .values({ ...dbData, orgId } as any)
      .returning();
    await createAuditLog({
      orgId,
      userId: auditUserId,
      action: 'create',
      entityType: 'hr_exit_interview',
      entityId: row.id,
      newValues: row,
    });
    return row;
  } catch (err) {
    console.error('[EmployeeService] createExitInterview error:', err);
    throw err;
  }
}

// ── Dependants ──

export async function getEmployeeDependants(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeDependants)
      .where(and(eq(hrEmployeeDependants.orgId, orgId), eq(hrEmployeeDependants.employeeId, empId)))
      .orderBy(desc(hrEmployeeDependants.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeDependants error:', err); throw err; }
}

export async function createEmployeeDependant(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmployeeDependants).values({ ...dbData, orgId } as any).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'create', entityType: 'hr_employee_dependant', entityId: row.id, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] createEmployeeDependant error:', err); throw err; }
}

export async function updateEmployeeDependant(orgId: string, dependantId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [old] = await db.select().from(hrEmployeeDependants).where(and(eq(hrEmployeeDependants.orgId, orgId), eq(hrEmployeeDependants.id, dependantId))).limit(1);
    if (!old) return null;
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrEmployeeDependants).set(dbData as any).where(and(eq(hrEmployeeDependants.orgId, orgId), eq(hrEmployeeDependants.id, dependantId))).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee_dependant', entityId: dependantId, oldValues: old, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] updateEmployeeDependant error:', err); throw err; }
}

export async function deleteEmployeeDependant(orgId: string, dependantId: string) {
  try {
    const [old] = await db.select().from(hrEmployeeDependants).where(and(eq(hrEmployeeDependants.orgId, orgId), eq(hrEmployeeDependants.id, dependantId))).limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrEmployeeDependants).where(and(eq(hrEmployeeDependants.orgId, orgId), eq(hrEmployeeDependants.id, dependantId))).returning();
    return row;
  } catch (err) { console.error('[EmployeeService] deleteEmployeeDependant error:', err); throw err; }
}

// ── Education ──

export async function getEmployeeEducation(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeEducation)
      .where(and(eq(hrEmployeeEducation.orgId, orgId), eq(hrEmployeeEducation.employeeId, empId)))
      .orderBy(desc(hrEmployeeEducation.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeEducation error:', err); throw err; }
}

export async function createEmployeeEducation(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmployeeEducation).values({ ...dbData, orgId } as any).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'create', entityType: 'hr_employee_education', entityId: row.id, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] createEmployeeEducation error:', err); throw err; }
}

export async function updateEmployeeEducation(orgId: string, eduId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [old] = await db.select().from(hrEmployeeEducation).where(and(eq(hrEmployeeEducation.orgId, orgId), eq(hrEmployeeEducation.id, eduId))).limit(1);
    if (!old) return null;
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrEmployeeEducation).set(dbData as any).where(and(eq(hrEmployeeEducation.orgId, orgId), eq(hrEmployeeEducation.id, eduId))).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee_education', entityId: eduId, oldValues: old, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] updateEmployeeEducation error:', err); throw err; }
}

export async function deleteEmployeeEducation(orgId: string, eduId: string) {
  try {
    const [old] = await db.select().from(hrEmployeeEducation).where(and(eq(hrEmployeeEducation.orgId, orgId), eq(hrEmployeeEducation.id, eduId))).limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrEmployeeEducation).where(and(eq(hrEmployeeEducation.orgId, orgId), eq(hrEmployeeEducation.id, eduId))).returning();
    return row;
  } catch (err) { console.error('[EmployeeService] deleteEmployeeEducation error:', err); throw err; }
}

// ── Employment History ──

export async function getEmployeeEmploymentHistory(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeEmploymentHistory)
      .where(and(eq(hrEmployeeEmploymentHistory.orgId, orgId), eq(hrEmployeeEmploymentHistory.employeeId, empId)))
      .orderBy(desc(hrEmployeeEmploymentHistory.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeEmploymentHistory error:', err); throw err; }
}

export async function createEmployeeEmploymentHistory(orgId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmployeeEmploymentHistory).values({ ...dbData, orgId } as any).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'create', entityType: 'hr_employee_employment_history', entityId: row.id, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] createEmployeeEmploymentHistory error:', err); throw err; }
}

export async function updateEmployeeEmploymentHistory(orgId: string, histId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [old] = await db.select().from(hrEmployeeEmploymentHistory).where(and(eq(hrEmployeeEmploymentHistory.orgId, orgId), eq(hrEmployeeEmploymentHistory.id, histId))).limit(1);
    if (!old) return null;
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrEmployeeEmploymentHistory).set(dbData as any).where(and(eq(hrEmployeeEmploymentHistory.orgId, orgId), eq(hrEmployeeEmploymentHistory.id, histId))).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee_employment_history', entityId: histId, oldValues: old, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] updateEmployeeEmploymentHistory error:', err); throw err; }
}

export async function deleteEmployeeEmploymentHistory(orgId: string, histId: string) {
  try {
    const [old] = await db.select().from(hrEmployeeEmploymentHistory).where(and(eq(hrEmployeeEmploymentHistory.orgId, orgId), eq(hrEmployeeEmploymentHistory.id, histId))).limit(1);
    if (!old) return null;
    const [row] = await db.delete(hrEmployeeEmploymentHistory).where(and(eq(hrEmployeeEmploymentHistory.orgId, orgId), eq(hrEmployeeEmploymentHistory.id, histId))).returning();
    return row;
  } catch (err) { console.error('[EmployeeService] deleteEmployeeEmploymentHistory error:', err); throw err; }
}

// ── Skills ──

export async function getEmployeeSkills(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeSkills)
      .where(and(eq(hrEmployeeSkills.orgId, orgId), eq(hrEmployeeSkills.employeeId, empId)))
      .orderBy(desc(hrEmployeeSkills.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeSkills error:', err); throw err; }
}

export async function createEmployeeSkill(orgId: string, data: any) {
  try {
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmployeeSkills).values({ ...dbData, orgId } as any).returning();
    return row;
  } catch (err) { console.error('[EmployeeService] createEmployeeSkill error:', err); throw err; }
}

export async function updateEmployeeSkill(orgId: string, skillId: string, data: any) {
  try {
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrEmployeeSkills).set(dbData as any).where(and(eq(hrEmployeeSkills.orgId, orgId), eq(hrEmployeeSkills.id, skillId))).returning();
    return row || null;
  } catch (err) { console.error('[EmployeeService] updateEmployeeSkill error:', err); throw err; }
}

export async function deleteEmployeeSkill(orgId: string, skillId: string) {
  try {
    const [row] = await db.delete(hrEmployeeSkills).where(and(eq(hrEmployeeSkills.orgId, orgId), eq(hrEmployeeSkills.id, skillId))).returning();
    return row || null;
  } catch (err) { console.error('[EmployeeService] deleteEmployeeSkill error:', err); throw err; }
}

// ── Certifications ──

export async function getEmployeeCertifications(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeCertifications)
      .where(and(eq(hrEmployeeCertifications.orgId, orgId), eq(hrEmployeeCertifications.employeeId, empId)))
      .orderBy(desc(hrEmployeeCertifications.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeCertifications error:', err); throw err; }
}

export async function createEmployeeCertification(orgId: string, data: any) {
  try {
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmployeeCertifications).values({ ...dbData, orgId } as any).returning();
    return row;
  } catch (err) { console.error('[EmployeeService] createEmployeeCertification error:', err); throw err; }
}

export async function updateEmployeeCertification(orgId: string, certId: string, data: any) {
  try {
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.update(hrEmployeeCertifications).set(dbData as any).where(and(eq(hrEmployeeCertifications.orgId, orgId), eq(hrEmployeeCertifications.id, certId))).returning();
    return row || null;
  } catch (err) { console.error('[EmployeeService] updateEmployeeCertification error:', err); throw err; }
}

export async function deleteEmployeeCertification(orgId: string, certId: string) {
  try {
    const [row] = await db.delete(hrEmployeeCertifications).where(and(eq(hrEmployeeCertifications.orgId, orgId), eq(hrEmployeeCertifications.id, certId))).returning();
    return row || null;
  } catch (err) { console.error('[EmployeeService] deleteEmployeeCertification error:', err); throw err; }
}

// ── Medical Information ──

export async function getEmployeeMedical(orgId: string, empId: string) {
  try {
    const [row] = await db.select().from(hrEmployeeMedical)
      .where(and(eq(hrEmployeeMedical.orgId, orgId), eq(hrEmployeeMedical.employeeId, empId)))
      .limit(1);
    return row || null;
  } catch (err) { console.error('[EmployeeService] getEmployeeMedical error:', err); throw err; }
}

export async function upsertEmployeeMedical(orgId: string, empId: string, data: any) {
  try {
    const [existing] = await db.select().from(hrEmployeeMedical)
      .where(and(eq(hrEmployeeMedical.orgId, orgId), eq(hrEmployeeMedical.employeeId, empId))).limit(1);
    if (existing) {
      const [row] = await db.update(hrEmployeeMedical).set(data as any)
        .where(and(eq(hrEmployeeMedical.orgId, orgId), eq(hrEmployeeMedical.employeeId, empId))).returning();
      return row;
    }
    const [row] = await db.insert(hrEmployeeMedical).values({ ...data, orgId, employeeId: empId } as any).returning();
    return row;
  } catch (err) { console.error('[EmployeeService] upsertEmployeeMedical error:', err); throw err; }
}

// ── Timeline ──

export async function addTimelineEntry(orgId: string, data: any) {
  try {
    const { userId: _u, ...dbData } = data || {};
    const [row] = await db.insert(hrEmployeeTimeline).values({ ...dbData, orgId } as any).returning();
    return row;
  } catch (err) { console.error('[EmployeeService] addTimelineEntry error:', err); throw err; }
}

export async function getEmployeeTimeline(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeTimeline)
      .where(and(eq(hrEmployeeTimeline.orgId, orgId), eq(hrEmployeeTimeline.employeeId, empId)))
      .orderBy(desc(hrEmployeeTimeline.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeTimeline error:', err); throw err; }
}

// ── Employee Lifecycle ──

export async function transferEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const transferData = {
      employeeId: empId, orgId,
      fromDepartmentId: emp.departmentId,
      toDepartmentId: data.toDepartmentId || emp.departmentId,
      fromDesignationId: emp.designationId,
      toDesignationId: data.toDesignationId || emp.designationId,
      effectiveDate: data.effectiveDate || new Date(),
      reason: data.reason,
      approvedBy: auditUserId,
    };
    const [transfer] = await db.insert(hrEmployeeTransfers).values(transferData as any).returning();
    await db.update(hrEmployees).set({
      departmentId: data.toDepartmentId || emp.departmentId,
      designationId: data.toDesignationId || emp.designationId,
      updatedAt: new Date(),
    } as any).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId)));
    const oldDept = await db.select({ name: hrDepartments.name }).from(hrDepartments).where(eq(hrDepartments.id, emp.departmentId)).limit(1);
    const newDept = await db.select({ name: hrDepartments.name }).from(hrDepartments).where(eq(hrDepartments.id, data.toDepartmentId)).limit(1);
    await addTimelineEntry(orgId, {
      employeeId: empId, eventType: 'transfer',
      description: `Transferred from ${oldDept[0]?.name || 'N/A'} to ${newDept[0]?.name || 'N/A'}`,
      oldValue: emp.departmentId, newValue: data.toDepartmentId, createdBy: auditUserId, userId: auditUserId,
    });
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: { departmentId: data.toDepartmentId, designationId: data.toDesignationId } });
    try { await dispatchEvent(orgId, 'employee.transferred', empId, { newDepartmentId: data.departmentId, newDesignationId: data.designationId, effectiveDate: data.effectiveDate, reason: data.reason }, userId); } catch (e) { console.error('[WF] dispatch employee.transferred error:', e); }
    return transfer;
  } catch (err) { console.error('[EmployeeService] transferEmployee error:', err); throw err; }
}

export async function getEmployeeTransfers(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeTransfers)
      .where(and(eq(hrEmployeeTransfers.orgId, orgId), eq(hrEmployeeTransfers.employeeId, empId)))
      .orderBy(desc(hrEmployeeTransfers.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeTransfers error:', err); throw err; }
}

export async function promoteEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [oldDesig] = await db.select({ title: hrDesignations.title }).from(hrDesignations)
      .where(eq(hrDesignations.id, emp.designationId)).limit(1);
    const [newDesig] = await db.select({ title: hrDesignations.title }).from(hrDesignations)
      .where(eq(hrDesignations.id, data.toDesignationId)).limit(1);
    const promoData = {
      employeeId: empId, orgId,
      fromDesignationId: emp.designationId,
      toDesignationId: data.toDesignationId,
      effectiveDate: data.effectiveDate || new Date(),
      reason: data.reason,
      approvalStatus: data.approvalStatus || 'approved',
      approvedBy: auditUserId,
    };
    const [promo] = await db.insert(hrEmployeePromotions).values(promoData as any).returning();
    await db.update(hrEmployees).set({ designationId: data.toDesignationId, updatedAt: new Date() } as any)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId)));
    await addTimelineEntry(orgId, {
      employeeId: empId, eventType: 'promotion',
      description: `Promoted from ${oldDesig?.title || 'N/A'} to ${newDesig?.title || 'N/A'}`,
      oldValue: emp.designationId, newValue: data.toDesignationId, createdBy: auditUserId, userId: auditUserId,
    });
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: { designationId: data.toDesignationId } });
    try { await dispatchEvent(orgId, 'employee.promoted', empId, { newDesignationId: data.designationId, newSalary: data.newSalary, effectiveDate: data.effectiveDate, reason: data.reason }, userId); } catch (e) { console.error('[WF] dispatch employee.promoted error:', e); }
    return promo;
  } catch (err) { console.error('[EmployeeService] promoteEmployee error:', err); throw err; }
}

export async function getEmployeePromotions(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeePromotions)
      .where(and(eq(hrEmployeePromotions.orgId, orgId), eq(hrEmployeePromotions.employeeId, empId)))
      .orderBy(desc(hrEmployeePromotions.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeePromotions error:', err); throw err; }
}

export async function confirmEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const confirmDate = data.confirmDate || new Date();
    const [row] = await db.update(hrEmployees).set({ confirmDate, updatedAt: new Date() } as any)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await addTimelineEntry(orgId, {
      employeeId: empId, eventType: 'confirmation',
      description: 'Employment confirmed',
      newValue: confirmDate.toString(), createdBy: auditUserId, userId: auditUserId,
    });
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    try { await dispatchEvent(orgId, 'employee.confirmed', empId, { confirmationDate: data.confirmationDate, notes: data.notes }, userId); } catch (e) { console.error('[WF] dispatch employee.confirmed error:', e); }
    return row;
  } catch (err) { console.error('[EmployeeService] confirmEmployee error:', err); throw err; }
}

export async function suspendEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [disc] = await db.insert(hrEmployeeDisciplinary).values({
      orgId, employeeId: empId, actionType: 'suspension',
      reason: data.reason || '', effectiveDate: data.effectiveDate || new Date(),
      duration: data.duration,
    } as any).returning();
    const [row] = await db.update(hrEmployees).set({ employmentStatus: 'suspended', updatedAt: new Date() } as any)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await addTimelineEntry(orgId, {
      employeeId: empId, eventType: 'suspension',
      description: `Employee suspended: ${data.reason || 'No reason provided'}`,
      oldValue: emp.employmentStatus, newValue: 'suspended', createdBy: auditUserId, userId: auditUserId,
    });
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    return { disciplinary: disc, employee: row };
  } catch (err) { console.error('[EmployeeService] suspendEmployee error:', err); throw err; }
}

export async function terminateEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [disc] = await db.insert(hrEmployeeDisciplinary).values({
      orgId, employeeId: empId, actionType: 'termination',
      reason: data.reason || '', effectiveDate: data.effectiveDate || new Date(),
    } as any).returning();
    const [row] = await db.update(hrEmployees).set({
      employmentStatus: 'terminated', isActive: false,
      exitDate: data.effectiveDate || new Date(), exitReason: data.reason,
      updatedAt: new Date(),
    } as any).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await addTimelineEntry(orgId, {
      employeeId: empId, eventType: 'termination',
      description: `Employment terminated: ${data.reason || 'No reason provided'}`,
      oldValue: emp.employmentStatus, newValue: 'terminated', createdBy: auditUserId, userId: auditUserId,
    });
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    try { await dispatchEvent(orgId, 'employee.terminated', empId, { terminationDate: data.terminationDate, reason: data.reason, terminationType: data.terminationType, noticePay: data.noticePay }, userId); } catch (e) { console.error('[WF] dispatch employee.terminated error:', e); }
    try { const { syncTerminationToPayroll, createOffboardingTasks } = await import('./integration.service'); await syncTerminationToPayroll(orgId, empId, data.effectiveDate || new Date(), data.reason, auditUserId); await createOffboardingTasks(orgId, empId, data.effectiveDate || new Date(), data.reason, auditUserId); } catch (e) { console.error('[INT] termination sync error:', e); }
    return { disciplinary: disc, employee: row };
  } catch (err) { console.error('[EmployeeService] terminateEmployee error:', err); throw err; }
}

export async function reinstateEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [disc] = await db.update(hrEmployeeDisciplinary).set({ isReinstated: true, reinstatedDate: data.effectiveDate || new Date() } as any)
      .where(and(eq(hrEmployeeDisciplinary.orgId, orgId), eq(hrEmployeeDisciplinary.employeeId, empId), eq(hrEmployeeDisciplinary.isReinstated, false)))
      .returning();
    const [row] = await db.update(hrEmployees).set({
      employmentStatus: 'active', isActive: true,
      exitDate: null, exitReason: null,
      updatedAt: new Date(),
    } as any).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await addTimelineEntry(orgId, {
      employeeId: empId, eventType: 'reinstatement',
      description: 'Employee reinstated',
      oldValue: emp.employmentStatus, newValue: 'active', createdBy: auditUserId, userId: auditUserId,
    });
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    try { await dispatchEvent(orgId, 'employee.reinstated', empId, { effectiveDate: data.effectiveDate, notes: data.notes }, userId); } catch (e) { console.error('[WF] dispatch employee.reinstated error:', e); }
    return { disciplinary: disc, employee: row };
  } catch (err) { console.error('[EmployeeService] reinstateEmployee error:', err); throw err; }
}

export async function reactivateEmployee(orgId: string, empId: string, data: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [row] = await db.update(hrEmployees).set({
      isActive: true,
      exitDate: null, exitReason: null,
      updatedAt: new Date(),
    } as any).where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await addTimelineEntry(orgId, {
      employeeId: empId, eventType: 'reactivation',
      description: 'Employee reactivated',
      oldValue: 'inactive', newValue: 'active', createdBy: auditUserId, userId: auditUserId,
    });
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] reactivateEmployee error:', err); throw err; }
}

// ── Soft Delete / Restore ──

export async function softDeleteEmployee(orgId: string, empId: string, data?: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [row] = await db.update(hrEmployees).set({ isActive: false, updatedAt: new Date() } as any)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'delete', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] softDeleteEmployee error:', err); throw err; }
}

export async function restoreEmployee(orgId: string, empId: string, data?: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [row] = await db.update(hrEmployees).set({ isActive: true, updatedAt: new Date() } as any)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] restoreEmployee error:', err); throw err; }
}

// ── Bulk Import / Export ──

export async function bulkImportEmployees(orgId: string, data: any[]) {
  try {
    const results: any[] = [];
    for (const row of data) {
      try {
        const empData = { ...row, orgId };
        if (!empData.employeeCode) {
          empData.employeeCode = await generateEmployeeCode(orgId);
        }
        const [emp] = await db.insert(hrEmployees).values(empData as any).returning();
        results.push({ success: true, employee: emp });
      } catch (err: any) {
        results.push({ success: false, error: err.message, data: row });
      }
    }
    return results;
  } catch (err) {
    console.error('[EmployeeService] bulkImportEmployees error:', err);
    throw err;
  }
}

export async function bulkExportEmployees(orgId: string, filters?: EmployeeFilters) {
  try {
    return await getEmployees(orgId, filters);
  } catch (err) {
    console.error('[EmployeeService] bulkExportEmployees error:', err);
    throw err;
  }
}

// ── Disciplinary Records ──

export async function getEmployeeDisciplinaryRecords(orgId: string, empId: string) {
  try {
    return await db.select().from(hrEmployeeDisciplinary)
      .where(and(eq(hrEmployeeDisciplinary.orgId, orgId), eq(hrEmployeeDisciplinary.employeeId, empId)))
      .orderBy(desc(hrEmployeeDisciplinary.createdAt));
  } catch (err) { console.error('[EmployeeService] getEmployeeDisciplinaryRecords error:', err); throw err; }
}

// ── Photo Upload (stores URL, actual upload handled by file middleware) ──

export async function updateEmployeePhoto(orgId: string, empId: string, photoUrl: string, data?: any) {
  try {
    const auditUserId = data?.userId || 'system';
    const [emp] = await db.select().from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).limit(1);
    if (!emp) return null;
    const [row] = await db.update(hrEmployees).set({ photoUrl, updatedAt: new Date() } as any)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.id, empId))).returning();
    await createAuditLog({ orgId, userId: auditUserId, action: 'update', entityType: 'hr_employee', entityId: empId, oldValues: emp, newValues: row });
    return row;
  } catch (err) { console.error('[EmployeeService] updateEmployeePhoto error:', err); throw err; }
}

// ── Full Employee Profile (all data sections) ──

export async function getEmployeeFullProfile(orgId: string, empId: string) {
  try {
    const employee = await getEmployee(orgId, empId);
    if (!employee) return null;
    const [documents, emergencyContacts, dependants, education, employmentHistory, skills, certifications, medical, timeline, transfers, promotions, disciplinary] = await Promise.all([
      getEmployeeDocuments(orgId, empId),
      getEmergencyContacts(orgId, empId),
      getEmployeeDependants(orgId, empId),
      getEmployeeEducation(orgId, empId),
      getEmployeeEmploymentHistory(orgId, empId),
      getEmployeeSkills(orgId, empId),
      getEmployeeCertifications(orgId, empId),
      getEmployeeMedical(orgId, empId),
      getEmployeeTimeline(orgId, empId),
      getEmployeeTransfers(orgId, empId),
      getEmployeePromotions(orgId, empId),
      getEmployeeDisciplinaryRecords(orgId, empId),
    ]);
    const [comp] = await db.select().from(hrEmployeeCompensation)
      .where(and(eq(hrEmployeeCompensation.orgId, orgId), eq(hrEmployeeCompensation.employeeId, empId)))
      .orderBy(desc(hrEmployeeCompensation.createdAt)).limit(1);
    return {
      employee,
      documents,
      emergencyContacts,
      dependants,
      education,
      employmentHistory,
      skills,
      certifications,
      medical,
      timeline,
      transfers,
      promotions,
      disciplinary,
      compensation: comp || null,
    };
  } catch (err) {
    console.error('[EmployeeService] getEmployeeFullProfile error:', err);
    throw err;
  }
}

// ── Dashboard ──

export async function getEmployeeDashboard(orgId: string) {
  try {
    const [totalResult] = await db.select({ count: count() }).from(hrEmployees)
      .where(eq(hrEmployees.orgId, orgId));

    const [activeResult] = await db.select({ count: count() }).from(hrEmployees)
      .where(and(eq(hrEmployees.orgId, orgId), eq(hrEmployees.isActive, true)));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [newThisMonthResult] = await db.select({ count: count() }).from(hrEmployees)
      .where(and(
        eq(hrEmployees.orgId, orgId),
        sql`${hrEmployees.createdAt} >= ${startOfMonth}`,
      ));

    const [deptResult] = await db.select({ count: count() }).from(hrDepartments)
      .where(eq(hrDepartments.orgId, orgId));

    const [desigResult] = await db.select({ count: count() }).from(hrDesignations)
      .where(eq(hrDesignations.orgId, orgId));

    const recentEmployees = await db.select().from(hrEmployees)
      .where(eq(hrEmployees.orgId, orgId))
      .orderBy(desc(hrEmployees.createdAt))
      .limit(5);

    return {
      totalEmployees: totalResult?.count ?? 0,
      activeCount: activeResult?.count ?? 0,
      newThisMonth: newThisMonthResult?.count ?? 0,
      departmentCount: deptResult?.count ?? 0,
      designationCount: desigResult?.count ?? 0,
      recentEmployees,
    };
  } catch (err) {
    console.error('[EmployeeService] getEmployeeDashboard error:', err);
    throw err;
  }
}
