/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Search, X, Edit2, Loader2, RefreshCw,
  User, Mail, Phone, Building2, Briefcase, CreditCard,
  Calendar, Hash, CheckCircle, XCircle, ChevronDown, Save
} from 'lucide-react';
import { payrollApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../hooks/useCurrency';

interface EmployeesPageProps {}

const DEPARTMENTS = ['Engineering', 'Finance', 'Sales', 'HR', 'Operations', 'Legal', 'Marketing', 'IT', 'Management'];
const FREQUENCIES = [{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Bi-weekly' }];

const emptyForm = {
  staffId: '', firstName: '', lastName: '', email: '', phone: '',
  department: '', designation: '', dateOfBirth: '', dateHired: '',
  bankName: '', accountNumber: '', grossSalary: 0,
  paymentFrequency: 'monthly', pensionPin: '', nhfNumber: '', taxId: '', isActive: true
};

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none transition"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none transition"
      >
        <option value="">— Select —</option>
        {options.map((o: any) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}

export function EmployeesPage({}: EmployeesPageProps) {
  const { token } = useAuth();
  const { formatNaira } = useCurrency();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: payrollApi.getEmployees,
    enabled: !!token,
  });

  const employees = useMemo(() => {
    const list = Array.isArray(employeesData) ? employeesData : (employeesData?.employees || []);
    return list.filter((e: any) => {
      const name = `${e.firstName} ${e.lastName} ${e.staffId} ${e.email || ''}`.toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase());
      const matchDept = filterDept === 'all' || e.department === filterDept;
      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? e.isActive : !e.isActive);
      return matchSearch && matchDept && matchStatus;
    });
  }, [employeesData, search, filterDept, filterStatus]);

  const createMutation = useMutation({
    mutationFn: payrollApi.createEmployee,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => payrollApi.updateEmployee(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); resetForm(); },
  });

  function resetForm() { setForm({ ...emptyForm }); setShowForm(false); setEditingId(null); }

  function openEdit(emp: any) {
    setForm({
      staffId: emp.staffId || '', firstName: emp.firstName || '', lastName: emp.lastName || '',
      email: emp.email || '', phone: emp.phone || '', department: emp.department || '',
      designation: emp.designation || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      dateHired: emp.dateHired ? emp.dateHired.split('T')[0] : '',
      bankName: emp.bankName || '', accountNumber: emp.accountNumber || '',
      grossSalary: Math.round((emp.grossSalary || 0) / 100),
      paymentFrequency: emp.paymentFrequency || 'monthly',
      pensionPin: emp.pensionPin || '', nhfNumber: emp.nhfNumber || '',
      taxId: emp.taxId || '', isActive: emp.isActive !== false,
    });
    setEditingId(emp.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, grossSalary: Math.round(Number(form.grossSalary) * 100) };
    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  }

  const f = (key: string) => (val: any) => setForm(prev => ({ ...prev, [key]: val }));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const activeCount = (Array.isArray(employeesData) ? employeesData : (employeesData?.employees || [])).filter((e: any) => e.isActive).length;
  const totalPayroll = (Array.isArray(employeesData) ? employeesData : (employeesData?.employees || [])).filter((e: any) => e.isActive).reduce((s: number, e: any) => s + (e.grossSalary || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Employees</h2>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Personnel Directory & Payroll Setup</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-500 outline-none">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition">
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Employees</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{(Array.isArray(employeesData) ? employeesData : (employeesData?.employees || [])).length}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Active Staff</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Monthly Payroll</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatNaira(totalPayroll)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, staff ID, email..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none transition" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:border-indigo-400 outline-none">
          <option value="all">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:border-indigo-400 outline-none">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || filterDept !== 'all' || filterStatus !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterDept('all'); setFilterStatus('all'); }}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Employee table */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin" />
            <span className="text-xs font-semibold">Loading personnel directory...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
              <User className="w-7 h-7 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">No employees found</p>
              <p className="text-xs text-slate-400 mt-1">Add your first employee to get started with payroll.</p>
            </div>
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg">
              Add First Employee
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[11px] text-slate-500 uppercase tracking-wide font-bold">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Gross Salary</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-slate-400">{emp.staffId} · {emp.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.department || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.designation || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 tabular-nums">{formatNaira(emp.grossSalary || 0)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full capitalize">{emp.paymentFrequency}</span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.isActive
                        ? <span className="flex items-center gap-1 text-xs text-green-700 font-semibold"><CheckCircle className="w-3.5 h-3.5" /> Active</span>
                        : <span className="flex items-center gap-1 text-xs text-slate-400 font-semibold"><XCircle className="w-3.5 h-3.5" /> Inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(emp)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition opacity-0 group-hover:opacity-100">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Employee Drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative ml-auto w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-base font-bold text-slate-900">{editingId ? 'Edit Employee' : 'Add New Employee'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Personnel & payroll configuration</p>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 outline-none">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Staff ID" value={form.staffId} onChange={f('staffId')} placeholder="EMP-001" required />
                  <Field label="Date Hired" value={form.dateHired} onChange={f('dateHired')} type="date" />
                  <Field label="First Name" value={form.firstName} onChange={f('firstName')} placeholder="John" required />
                  <Field label="Last Name" value={form.lastName} onChange={f('lastName')} placeholder="Doe" required />
                  <Field label="Email" value={form.email} onChange={f('email')} type="email" placeholder="john@company.com" />
                  <Field label="Phone" value={form.phone} onChange={f('phone')} placeholder="+234 801 234 5678" />
                  <Field label="Date of Birth" value={form.dateOfBirth} onChange={f('dateOfBirth')} type="date" />
                </div>
              </div>

              {/* Job Info */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5" /> Job Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <SelectField label="Department" value={form.department} onChange={f('department')} options={DEPARTMENTS} />
                  <Field label="Designation / Job Title" value={form.designation} onChange={f('designation')} placeholder="Software Engineer" />
                  <SelectField label="Pay Frequency" value={form.paymentFrequency} onChange={f('paymentFrequency')} options={FREQUENCIES} />
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Gross Salary (₦)<span className="text-red-500 ml-0.5">*</span></label>
                    <input type="number" value={form.grossSalary} onChange={e => f('grossSalary')(e.target.value)} min={0} required
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none transition" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={e => f('isActive')(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">Active Employee</span>
                  </label>
                </div>
              </div>

              {/* Bank Info */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5" /> Bank & Tax Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name" value={form.bankName} onChange={f('bankName')} placeholder="GTBank" />
                  <Field label="Account Number" value={form.accountNumber} onChange={f('accountNumber')} placeholder="0123456789" />
                  <Field label="Tax ID (TIN)" value={form.taxId} onChange={f('taxId')} placeholder="TIN12345678" />
                  <Field label="Pension PIN" value={form.pensionPin} onChange={f('pensionPin')} placeholder="PEN100012345" />
                  <Field label="NHF Number" value={form.nhfNumber} onChange={f('nhfNumber')} placeholder="NHF123456" />
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-4 flex gap-3">
                <button type="button" onClick={resetForm}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingId ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
