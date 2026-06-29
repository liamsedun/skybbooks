/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Search, X, Edit2, Loader2, RefreshCw,
  User, Phone, Briefcase, CreditCard,
  CheckCircle, XCircle, Save, GraduationCap,
  Award, Building2, Heart, Shield, Users, Plus, Trash2, MapPin, Upload,
  Download, ToggleLeft, ToggleRight, AlertCircle, Settings, Trash, DollarSign
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { exportToCsv } from '../../lib/csvTemplates';
import { payrollApi, apiDownload } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency } from '../../hooks/useCurrency';

const DEPARTMENTS = ['Engineering', 'Finance', 'Sales', 'HR', 'Operations', 'Legal', 'Marketing', 'IT', 'Management'];
const FREQUENCIES = [{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Bi-weekly' }];
const EDU_LEVELS = ['SSCE / WAEC', 'OND', 'HND', 'B.Sc / B.A', 'M.Sc / M.A', 'MBA', 'Ph.D', 'Others'];

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false, span2 = false }: any) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none transition" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, span2 = false }: any) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 outline-none transition">
        <option value="">— Select —</option>
        {options.map((o: any) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: any) {
  return (
    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
      <Icon className="w-3.5 h-3.5" /> {title}
    </h4>
  );
}

function RepeatableSection({ title, icon: Icon, items, setItems, fields, maxItems = 5 }: any) {
  function addItem() {
    if (items.length >= maxItems) return;
    const blank: any = {};
    fields.forEach((f: any) => blank[f.key] = '');
    setItems([...items, blank]);
  }
  function removeItem(i: number) { setItems(items.filter((_: any, idx: number) => idx !== i)); }
  function updateItem(i: number, key: string, val: string) {
    setItems(items.map((item: any, idx: number) => idx === i ? { ...item, [key]: val } : item));
  }
  return (
    <div className="space-y-3 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon={Icon} title={title} />
        {items.length < maxItems && (
          <button type="button" onClick={addItem}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>
      {items.length === 0 && (
        <button type="button" onClick={addItem}
          className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition flex items-center justify-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add {title}
        </button>
      )}
      {items.map((item: any, i: number) => (
        <div key={i} className="bg-slate-50 rounded-xl p-4 relative">
          <button type="button" onClick={() => removeItem(i)}
            className="absolute top-3 right-3 p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="grid grid-cols-2 gap-3 pr-6">
            {fields.map((f: any) => (
              f.type === 'select'
                ? <div key={f.key} className={f.span2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <select value={item[f.key]} onChange={e => updateItem(i, f.key, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-indigo-400 outline-none transition">
                      <option value="">— Select —</option>
                      {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                : <div key={f.key} className={f.span2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={item[f.key]} onChange={e => updateItem(i, f.key, e.target.value)}
                      placeholder={f.placeholder || ''}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-indigo-400 outline-none transition" />
                  </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyForm = {
  staffId: '', firstName: '', middleName: '', lastName: '', email: '', phone: '',
  address: '', department: '', designation: '', dateOfBirth: '', dateHired: '',
  bankName: '', accountNumber: '', grossSalary: 0,
  paymentFrequency: 'monthly', pensionPin: '', nhfNumber: '', taxId: '', isActive: true,
  pensionablePortionPct: 80, pensionRatePct: 8,
  nhisApplicable: false, nhfApplicable: true,
  annualRent: 0, annualMortgageInterest: 0, annualLifeAssurance: 0,
  basicSalaryPct: 50, housingPct: 20, transportPct: 10,
  utilitiesPct: 10, mealsPct: 5, othersPct: 5,
};

const emptyEduQual = { level: '', institution: '', course: '', year: '' };
const emptyProfQual = { qualification: '', issuingBody: '', year: '' };
const emptyInstitution = { name: '', type: '', from: '', to: '', certificate: '' };
const emptyNextOfKin = { name: '', relationship: '', phone: '', address: '', email: '' };
const emptyGuarantor = { name: '', occupation: '', phone: '', address: '', relationship: '' };
const emptyReference = { name: '', title: '', organization: '', phone: '', email: '' };

export function EmployeesPage() {
  const { token } = useAuth();
  const { formatNaira } = useCurrency();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [lastImportIds, setLastImportIds] = useState<string[]>(() => {
    try { const stored = sessionStorage.getItem('lastEmployeeImportIds'); return stored ? JSON.parse(stored) : []; } catch { return []; }
  });
  const [clearMsg, setClearMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Repeatable sections state
  const [eduQuals, setEduQuals] = useState<any[]>([]);
  const [profQuals, setProfQuals] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [nextOfKin, setNextOfKin] = useState<any[]>([]);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [references, setReferences] = useState<any[]>([]);

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

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => payrollApi.updateEmployee(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const clearMutation = useMutation({
    mutationFn: (ids: string[]) => payrollApi.bulkDeleteEmployees(ids),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setLastImportIds([]); sessionStorage.removeItem('lastEmployeeImportIds'); setClearMsg({ type: 'success', text: 'Last import cleared successfully.' }); setTimeout(() => setClearMsg(null), 3000); },
    onError: () => { setClearMsg({ type: 'error', text: 'Failed to clear last import.' }); setTimeout(() => setClearMsg(null), 3000); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => payrollApi.deleteEmployee(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setSelectedIds(prev => prev.filter(i => i !== deletionTargetId)); setDeletionTargetId(null); },
    onError: (e: any) => { setClearMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to delete employee.' }); setTimeout(() => setClearMsg(null), 3000); },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => payrollApi.bulkDeleteEmployees(ids),
    onSuccess: (_, ids) => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setSelectedIds([]); setClearMsg({ type: 'success', text: `${ids.length} employee(s) deleted.` }); setTimeout(() => setClearMsg(null), 3000); },
    onError: (e: any) => { setClearMsg({ type: 'error', text: e?.response?.data?.error || 'Failed to delete employees.' }); setTimeout(() => setClearMsg(null), 3000); },
  });

  const [deletionTargetId, setDeletionTargetId] = useState<string | null>(null);

  function resetForm() {
    setForm({ ...emptyForm });
    setEduQuals([]); setProfQuals([]); setInstitutions([]);
    setNextOfKin([]); setGuarantors([]); setReferences([]);
    setShowForm(false); setEditingId(null);
  }

  function openEdit(emp: any) {
    setForm({
      staffId: emp.staffId || '', firstName: emp.firstName || '', middleName: emp.middleName || '', lastName: emp.lastName || '',
      email: emp.email || '', phone: emp.phone || '', address: emp.address || '',
      department: emp.department || '', designation: emp.designation || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      dateHired: emp.dateHired ? emp.dateHired.split('T')[0] : '',
      bankName: emp.bankName || '', accountNumber: emp.accountNumber || '',
      grossSalary: Math.round((emp.grossSalary || 0) / 100),
      paymentFrequency: emp.paymentFrequency || 'monthly',
      pensionPin: emp.pensionPin || '', nhfNumber: emp.nhfNumber || '',
      taxId: emp.taxId || '', isActive: emp.isActive !== false,
      pensionablePortionPct: emp.pensionablePortionPct ?? 80,
      pensionRatePct: emp.pensionRatePct ?? 8,
      nhisApplicable: emp.nhisApplicable ?? false,
      nhfApplicable: emp.nhfApplicable ?? true,
      annualRent: Math.round((emp.annualRent || 0) / 100),
      annualMortgageInterest: Math.round((emp.annualMortgageInterest || 0) / 100),
      annualLifeAssurance: Math.round((emp.annualLifeAssurance || 0) / 100),
      basicSalaryPct: emp.basicSalaryPct ?? 50,
      housingPct: emp.housingPct ?? 20,
      transportPct: emp.transportPct ?? 10,
      utilitiesPct: emp.utilitiesPct ?? 10,
      mealsPct: emp.mealsPct ?? 5,
      othersPct: emp.othersPct ?? 5,
    });
    setEduQuals(emp.eduQuals || []);
    setProfQuals(emp.profQuals || []);
    setInstitutions(emp.institutions || []);
    setNextOfKin(emp.nextOfKin || []);
    setGuarantors(emp.guarantors || []);
    setReferences(emp.references || []);
    setEditingId(emp.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      grossSalary: Math.round(Number(form.grossSalary) * 100),
      annualRent: Math.round(Number(form.annualRent) * 100),
      annualMortgageInterest: Math.round(Number(form.annualMortgageInterest) * 100),
      annualLifeAssurance: Math.round(Number(form.annualLifeAssurance) * 100),
      eduQuals, profQuals, institutions, nextOfKin, guarantors, references,
    };
    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  }

  const f = (key: string) => (val: any) => setForm(prev => ({ ...prev, [key]: val }));
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const allEmployees = Array.isArray(employeesData) ? employeesData : (employeesData?.employees || []);
  const activeCount = allEmployees.filter((e: any) => e.isActive).length;
  const totalPayroll = allEmployees.filter((e: any) => e.isActive).reduce((s: number, e: any) => s + (e.grossSalary || 0), 0);

  function exportEmployeesCSV() {
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Staff ID', 'First Name', 'Last Name', 'Email', 'Department', 'Designation', 'Gross Salary', 'Frequency', 'Status'];
    const rows = employees.map((e: any) => [e.staffId, e.firstName, e.lastName, e.email||'', e.department||'', e.designation||'', (e.grossSalary/100).toFixed(2), e.paymentFrequency||'monthly', e.isActive ? 'Active' : 'Inactive']);
    exportToCsv(`employees_${today}.csv`, headers, rows);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Employees</h2>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Personnel Directory & Payroll Setup</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {selectedIds.length > 0 && (
            <button onClick={() => { if (confirm(`Delete ${selectedIds.length} selected employee(s)?`)) batchDeleteMutation.mutate(selectedIds); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100">
              <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.length})
            </button>
          )}
          <button onClick={exportEmployeesCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => apiDownload('/payroll/employees/pdf', `employees_${new Date().toISOString().split('T')[0]}.pdf`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          {lastImportIds.length > 0 && (
            <button onClick={() => { if (confirm('Delete all employees from the last CSV import?')) clearMutation.mutate(lastImportIds); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100" title="Clear Last Import">
              <AlertCircle className="w-3.5 h-3.5" /> Clear Import
            </button>
          )}
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg">
            <UserPlus className="w-3.5 h-3.5" /> Add Employee
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Employees</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{allEmployees.length}</p>
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

      {/* Clear message */}
      {clearMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold ${clearMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {clearMsg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {clearMsg.text}
        </div>
      )}

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
          <button onClick={() => setImportOpen(true)}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-500 outline-none">
            <Upload className="w-4 h-4" />
          </button>
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
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" checked={selectedIds.length === employees.length && employees.length > 0}
                        onChange={e => { if (e.target.checked) { setSelectedIds(employees.map((e: any) => e.id)); } else { setSelectedIds([]); } }} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </th>
                    <th className="px-4 py-3">Staff ID</th>
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
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedIds.includes(emp.id)}
                          onChange={e => { setSelectedIds(prev => e.target.checked ? [...prev, emp.id] : prev.filter(i => i !== emp.id)); }}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.staffId || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-slate-400">{emp.email || '—'}</p>
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
                      <button onClick={() => toggleActiveMutation.mutate({ id: emp.id, isActive: !emp.isActive })}
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition ${
                          emp.isActive
                            ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                            : 'text-slate-400 bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}>
                        {emp.isActive ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(emp)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm(`Delete employee ${emp.firstName} ${emp.lastName}?`)) deleteMutation.mutate(emp.id); }}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
          <div className="relative ml-auto w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-base font-bold text-slate-900">{editingId ? 'Edit Employee' : 'Add New Employee'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Personnel record & payroll configuration</p>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 outline-none">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6">

              {/* 1. Personal Information */}
              <div className="space-y-4">
                <SectionHeader icon={User} title="Personal Information" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Staff ID" value={form.staffId} onChange={f('staffId')} placeholder="EMP-001" required />
                  <Field label="Date Hired" value={form.dateHired} onChange={f('dateHired')} type="date" />
                  <Field label="First Name" value={form.firstName} onChange={f('firstName')} placeholder="John" required />
                  <Field label="Middle Name" value={form.middleName} onChange={f('middleName')} placeholder="Michael" />
                  <Field label="Last Name" value={form.lastName} onChange={f('lastName')} placeholder="Doe" required />
                  <Field label="Email" value={form.email} onChange={f('email')} type="email" placeholder="john@company.com" />
                  <Field label="Phone" value={form.phone} onChange={f('phone')} placeholder="+234 801 234 5678" />
                  <Field label="Date of Birth" value={form.dateOfBirth} onChange={f('dateOfBirth')} type="date" />
                  <Field label="Residential Address" value={form.address} onChange={f('address')} placeholder="12 Main Street, Lagos" span2 />
                </div>
              </div>

              {/* 2. Job Details */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <SectionHeader icon={Briefcase} title="Job Details" />
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => f('isActive')(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">Active Employee</span>
                </label>
              </div>

              {/* 3. Bank & Tax */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <SectionHeader icon={CreditCard} title="Bank & Tax Details" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name" value={form.bankName} onChange={f('bankName')} placeholder="GTBank" />
                  <Field label="Account Number" value={form.accountNumber} onChange={f('accountNumber')} placeholder="0123456789" />
                  <Field label="Tax ID (TIN)" value={form.taxId} onChange={f('taxId')} placeholder="TIN12345678" />
                  <Field label="Pension PIN" value={form.pensionPin} onChange={f('pensionPin')} placeholder="PEN100012345" />
                  <Field label="NHF Number" value={form.nhfNumber} onChange={f('nhfNumber')} placeholder="NHF123456" />
                </div>
              </div>

              {/* 3b. Payroll Settings */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <SectionHeader icon={Settings} title="Payroll Settings (2026 PITA)" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Pensionable Portion (%)" value={form.pensionablePortionPct} onChange={f('pensionablePortionPct')} type="number" placeholder="80" />
                  <Field label="Pension Rate (%)" value={form.pensionRatePct} onChange={f('pensionRatePct')} type="number" placeholder="8" />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.nhisApplicable} onChange={e => f('nhisApplicable')(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">NHIS Applicable (5% of Basic)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.nhfApplicable} onChange={e => f('nhfApplicable')(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">NHF Applicable (2.5% of Basic)</span>
                  </label>
                  <Field label="Annual Rent (₦)" value={form.annualRent} onChange={f('annualRent')} type="number" placeholder="0" />
                  <Field label="Annual Mortgage Interest (₦)" value={form.annualMortgageInterest} onChange={f('annualMortgageInterest')} type="number" placeholder="0" />
                  <Field label="Annual Life Assurance (₦)" value={form.annualLifeAssurance} onChange={f('annualLifeAssurance')} type="number" placeholder="0" />
                </div>
              </div>

              {/* 3c. Salary Breakdown */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <SectionHeader icon={DollarSign} title="Salary Breakdown (%)" desc="Percentages of gross salary allocated to each component." />
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Basic Salary (%)" value={form.basicSalaryPct} onChange={f('basicSalaryPct')} type="number" min={0} max={100} placeholder="50" />
                  <Field label="Housing Allowance (%)" value={form.housingPct} onChange={f('housingPct')} type="number" min={0} max={100} placeholder="20" />
                  <Field label="Transport Allowance (%)" value={form.transportPct} onChange={f('transportPct')} type="number" min={0} max={100} placeholder="10" />
                  <Field label="Utilities Allowance (%)" value={form.utilitiesPct} onChange={f('utilitiesPct')} type="number" min={0} max={100} placeholder="10" />
                  <Field label="Meals Allowance (%)" value={form.mealsPct} onChange={f('mealsPct')} type="number" min={0} max={100} placeholder="5" />
                  <Field label="Others (%)" value={form.othersPct} onChange={f('othersPct')} type="number" min={0} max={100} placeholder="5" />
                </div>
                {(() => {
                  const total = Number(form.basicSalaryPct || 0) + Number(form.housingPct || 0) + Number(form.transportPct || 0) + Number(form.utilitiesPct || 0) + Number(form.mealsPct || 0) + Number(form.othersPct || 0);
                  return total === 100
                    ? <p className="text-xs text-emerald-600 font-medium">Total: {total}% ✓</p>
                    : <p className="text-xs text-rose-600 font-medium">Total: {total}% — must equal 100%</p>;
                })()}
              </div>

              {/* 4. Educational Qualifications */}
              <RepeatableSection
                title="Educational Qualifications"
                icon={GraduationCap}
                items={eduQuals}
                setItems={setEduQuals}
                maxItems={5}
                fields={[
                  { key: 'level', label: 'Qualification Level', type: 'select', options: EDU_LEVELS },
                  { key: 'course', label: 'Course / Field of Study', placeholder: 'Computer Science' },
                  { key: 'institution', label: 'Institution', placeholder: 'University of Lagos', span2: true },
                  { key: 'year', label: 'Year Obtained', type: 'number', placeholder: '2015' },
                ]}
              />

              {/* 5. Professional Qualifications */}
              <RepeatableSection
                title="Professional Qualifications"
                icon={Award}
                items={profQuals}
                setItems={setProfQuals}
                maxItems={5}
                fields={[
                  { key: 'qualification', label: 'Qualification', placeholder: 'ICAN, CIPM, PMP...' },
                  { key: 'issuingBody', label: 'Issuing Body', placeholder: 'ICAN' },
                  { key: 'year', label: 'Year Obtained', type: 'number', placeholder: '2018' },
                ]}
              />

              {/* 6. Institutions Attended */}
              <RepeatableSection
                title="Institutions Attended"
                icon={Building2}
                items={institutions}
                setItems={setInstitutions}
                maxItems={5}
                fields={[
                  { key: 'name', label: 'Institution Name', placeholder: 'University of Lagos', span2: true },
                  { key: 'type', label: 'Type', type: 'select', options: ['Primary', 'Secondary', 'Polytechnic', 'University', 'Professional', 'Others'] },
                  { key: 'certificate', label: 'Certificate Obtained', placeholder: 'B.Sc Computer Science' },
                  { key: 'from', label: 'From (Year)', type: 'number', placeholder: '2010' },
                  { key: 'to', label: 'To (Year)', type: 'number', placeholder: '2014' },
                ]}
              />

              {/* 7. Next of Kin */}
              <RepeatableSection
                title="Next of Kin"
                icon={Heart}
                items={nextOfKin}
                setItems={setNextOfKin}
                maxItems={1}
                fields={[
                  { key: 'name', label: 'Full Name', placeholder: 'Jane Doe', span2: true },
                  { key: 'relationship', label: 'Relationship', placeholder: 'Spouse / Sibling...' },
                  { key: 'phone', label: 'Phone Number', placeholder: '+234 801 234 5678' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'jane@example.com' },
                  { key: 'address', label: 'Address', placeholder: '12 Main Street, Lagos', span2: true },
                ]}
              />

              {/* 8. Guarantors */}
              <RepeatableSection
                title="Guarantors"
                icon={Shield}
                items={guarantors}
                setItems={setGuarantors}
                maxItems={3}
                fields={[
                  { key: 'name', label: 'Full Name', placeholder: 'Mr. John Smith', span2: true },
                  { key: 'occupation', label: 'Occupation', placeholder: 'Civil Servant' },
                  { key: 'relationship', label: 'Relationship', placeholder: 'Friend / Colleague' },
                  { key: 'phone', label: 'Phone Number', placeholder: '+234 801 234 5678' },
                  { key: 'address', label: 'Address', placeholder: '12 Main Street, Lagos', span2: true },
                ]}
              />

              {/* 9. References */}
              <RepeatableSection
                title="References"
                icon={Users}
                items={references}
                setItems={setReferences}
                maxItems={3}
                fields={[
                  { key: 'name', label: 'Full Name', placeholder: 'Dr. Adaeze Obi', span2: true },
                  { key: 'title', label: 'Title / Designation', placeholder: 'Director, Finance' },
                  { key: 'organization', label: 'Organisation', placeholder: 'ABC Ltd' },
                  { key: 'phone', label: 'Phone Number', placeholder: '+234 801 234 5678' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'adaeze@abc.com' },
                ]}
              />

              {/* Submit */}
              <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-4 flex gap-3 pb-2">
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
      {importOpen && (
        <CsvImportModal
          entity="employees"
          endpoint="/payroll/employees"
          onClose={() => setImportOpen(false)}
          onSuccess={(ids) => { if (ids && ids.length) { setLastImportIds(ids); sessionStorage.setItem('lastEmployeeImportIds', JSON.stringify(ids)); } queryClient.invalidateQueries({ queryKey: ['employees'] }); }}
          transformRow={(row, headers) => ({
            staffId: row[headers.indexOf('staffId')]?.trim() || '',
            firstName: row[headers.indexOf('firstName')]?.trim() || '',
            middleName: row[headers.indexOf('middleName')]?.trim() || null,
            lastName: row[headers.indexOf('lastName')]?.trim() || '',
            email: row[headers.indexOf('email')]?.trim() || null,
            phone: row[headers.indexOf('phone')]?.trim() || null,
            department: row[headers.indexOf('department')]?.trim() || null,
            designation: row[headers.indexOf('designation')]?.trim() || null,
            dateOfBirth: row[headers.indexOf('dateOfBirth (YYYY-MM-DD)')]?.trim() || null,
            dateHired: row[headers.indexOf('dateHired (YYYY-MM-DD)')]?.trim() || null,
            bankName: row[headers.indexOf('bankName')]?.trim() || null,
            accountNumber: row[headers.indexOf('accountNumber')]?.trim() || null,
            grossSalary: Math.round(parseFloat(row[headers.indexOf('grossSalary (NGN)')] || '0') * 100),
            paymentFrequency: row[headers.indexOf('paymentFrequency')]?.trim() || 'monthly',
            pensionPin: row[headers.indexOf('pensionPin')]?.trim() || null,
            nhfNumber: row[headers.indexOf('nhfNumber')]?.trim() || null,
            taxId: row[headers.indexOf('taxId')]?.trim() || null,
            isActive: row[headers.indexOf('isActive (yes/no)')]?.toLowerCase() === 'yes',
            pensionablePortionPct: parseInt(row[headers.indexOf('pensionablePortionPct (%)')]?.trim()) || 80,
            pensionRatePct: parseInt(row[headers.indexOf('pensionRatePct (%)')]?.trim()) || 8,
            nhisApplicable: row[headers.indexOf('nhisApplicable (yes/no)')]?.toLowerCase() === 'yes',
            nhfApplicable: row[headers.indexOf('nhfApplicable (yes/no)')]?.toLowerCase() === 'yes',
            annualRent: Math.round(parseFloat(row[headers.indexOf('annualRent (NGN)')] || '0') * 100),
            annualMortgageInterest: Math.round(parseFloat(row[headers.indexOf('annualMortgageInterest (NGN)')] || '0') * 100),
            annualLifeAssurance: Math.round(parseFloat(row[headers.indexOf('annualLifeAssurance (NGN)')] || '0') * 100),
            basicSalaryPct: parseInt(row[headers.indexOf('basicSalaryPct (%)')]?.trim()) || 50,
            housingPct: parseInt(row[headers.indexOf('housingPct (%)')]?.trim()) || 20,
            transportPct: parseInt(row[headers.indexOf('transportPct (%)')]?.trim()) || 10,
            utilitiesPct: parseInt(row[headers.indexOf('utilitiesPct (%)')]?.trim()) || 10,
            mealsPct: parseInt(row[headers.indexOf('mealsPct (%)')]?.trim()) || 5,
            othersPct: parseInt(row[headers.indexOf('othersPct (%)')]?.trim()) || 5,
          })}
        />
      )}
    </div>
  );
}
