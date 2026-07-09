import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, api, printWindow } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import { useOrgSettings } from '../../hooks/useOrgSettings';
import { useOrg } from '../../hooks/useOrg';
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Briefcase, Search, Trash2, Edit3, Eye, Printer, FileText
} from 'lucide-react';

const BILLING_METHODS = ['Fixed Price', 'Hourly Rate Per Task', 'Hourly Rate Per User', 'Milestone Based', 'Cost Plus', 'Retainer'] as const;

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const { settings } = useOrgSettings();
  const { organisation: org } = useOrg();
  const customFieldDefs: { name: string; dataType: string }[] = settings?.projects?.fields || [];

  const filteredProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q) ||
      (p.billingMethod || '').toLowerCase().includes(q) ||
      customFieldDefs.some((cf: any) =>
        (p.customFields?.[cf.name] || '').toString().toLowerCase().includes(q)
      )
    );
  }, [projects, search, customFieldDefs]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      projectsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Failed to update status.'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      setSuccess('Project created successfully.');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || err?.message || 'Failed to create project.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditTarget(null);
      setSuccess('Project updated successfully.');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || err?.message || 'Failed to update project.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteTarget(null);
      setSuccess('Project deleted successfully.');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setDeleteTarget(null);
      alert(err?.response?.data?.error || err?.message || 'Failed to delete project.');
    },
  });

  const handlePrint = useCallback(() => {
    try {
      const list = Array.isArray(projects) ? projects : [];
      const rows = list.map((p: any) =>
        `<tr>
          <td>${p.name || ''}</td>
          <td>${(p.customerName || '—')}</td>
          <td>${(p.billingMethod || 'Fixed Price')}</td>
          <td class="r">${fmtNaira(p.budget)}</td>
          <td class="c">${(p.status || 'active').charAt(0).toUpperCase() + (p.status || '').slice(1)}</td>
        </tr>`
      ).join('');

      const logoHtml = org?.logoUrl
        ? `<img src="${org.logoUrl}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;" />`
        : '';

      const headerHtml = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a">
        ${logoHtml ? `<div>${logoHtml}</div>` : ''}
        <div style="flex:1">
          <div style="font-size:18px;font-weight:700;color:#0f172a">${org?.name || ''}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${[org?.address, org?.phone, org?.email, org?.website].filter(Boolean).join(' | ')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:#0f172a">Projects</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>`;

      printWindow('Projects', headerHtml + rows ? `<table><thead><tr><th>Project</th><th>Customer</th><th>Billing Method</th><th class="r">Budget</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table>` : '<p style="text-align:center;color:#94a3b8">No projects</p>', '');
    } catch (err) {
      alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [projects, org]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-indigo-600" /> Projects
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
            <Printer className="w-4 h-4" /> Print PDF
          </button>
          <button onClick={() => { setShowForm(true); setEditTarget(null); setFormError(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200/80">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name, code, customer, billing method..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Project Form Modal */}
      {(showForm || editTarget) && (
        <ProjectForm
          editTarget={editTarget}
          onSave={(data) => {
            if (editTarget) {
              updateMutation.mutate({ id: editTarget.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          onClose={() => { setShowForm(false); setEditTarget(null); setFormError(null); }}
          error={formError}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Delete Project</h2>
            <p className="text-sm text-slate-600">
              Delete project <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all">
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewTarget && <ProjectDetailView project={viewTarget} onClose={() => setViewTarget(null)} org={org} />}

      {/* Projects Table */}
      {isLoading ? (
        <PageLoader message="Loading projects..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Project</th>
                <th className="px-3 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Billing Method</th>
                <th className="px-3 py-3 text-left">Start Date</th>
                <th className="px-3 py-3 text-left">End Date</th>
                <th className="px-3 py-3 text-right">Budget</th>
                <th className="px-3 py-3 text-center">Status</th>
                {customFieldDefs.map((cf, i) => (
                  <th key={i} className="px-3 py-3 text-left">{cf.name}</th>
                ))}
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.customerName || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.billingMethod || 'Fixed Price'}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(p.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(p.endDate)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{fmtNaira(p.budget)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        const next = p.status === 'active' ? 'completed' : p.status === 'completed' ? 'on_hold' : 'active';
                        statusMutation.mutate({ id: p.id, status: next });
                      }}
                      disabled={statusMutation.isPending}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border cursor-pointer transition-all ${
                        p.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' :
                        p.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200/50' :
                        p.status === 'on_hold' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                        'bg-slate-50 text-slate-500 border-slate-200/50'
                      }`}>
                      {p.status === 'active' ? 'Active' : p.status === 'completed' ? 'Completed' : p.status === 'on_hold' ? 'On Hold' : p.status || 'Active'}
                    </button>
                  </td>
                  {customFieldDefs.map((cf, i) => (
                    <td key={i} className="px-4 py-3 text-slate-600">{p.customFields?.[cf.name] ?? '—'}</td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => window.open(`/sales/invoices/new?projectId=${p.id}&customerId=${p.customerId || ''}`, '_blank')}
                        className="text-indigo-600 hover:text-indigo-800 p-1" title="Create Invoice">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button onClick={() => setViewTarget(p)}
                        className="text-indigo-600 hover:text-indigo-800 p-1" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditTarget(p); setFormError(null); setShowForm(true); }}
                        className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(p)}
                        className="text-red-500 hover:text-red-700 p-1" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={9 + customFieldDefs.length} className="px-4 py-8 text-center text-slate-400">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectDetailView({ project, onClose, org }: { project: any; onClose: () => void; org: any }) {
  const { settings } = useOrgSettings();
  const customFieldDefs: { name: string; dataType: string }[] = settings?.projects?.fields || [];
  const customFields = project.customFields || {};

  const handlePrint = () => {
    try {
      const logoHtml = org?.logoUrl
        ? `<img src="${org.logoUrl}" style="height:48px;width:48px;object-fit:contain;border-radius:8px;" />`
        : '';
      const headerHtml = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a">
        ${logoHtml ? `<div>${logoHtml}</div>` : ''}
        <div style="flex:1">
          <div style="font-size:18px;font-weight:700;color:#0f172a">${org?.name || ''}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${[org?.address, org?.phone, org?.email, org?.website].filter(Boolean).join(' | ')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:#0f172a">${project.name}</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
      </div>`;
      const details = `
      <table>
        <tbody>
          <tr><td style="font-weight:600;width:160px">Project</td><td>${project.name}</td></tr>
          <tr><td style="font-weight:600">Code</td><td>${project.code || '—'}</td></tr>
          <tr><td style="font-weight:600">Customer</td><td>${project.customerName || '—'}</td></tr>
          <tr><td style="font-weight:600">Billing Method</td><td>${project.billingMethod || 'Fixed Price'}</td></tr>
          <tr><td style="font-weight:600">Status</td><td>${project.status || 'active'}</td></tr>
          <tr><td style="font-weight:600">Start Date</td><td>${fmtDate(project.startDate)}</td></tr>
          <tr><td style="font-weight:600">End Date</td><td>${fmtDate(project.endDate)}</td></tr>
          <tr><td style="font-weight:600">Budget</td><td>${fmtNaira(project.budget)}</td></tr>
          ${project.description ? `<tr><td style="font-weight:600">Description</td><td>${project.description}</td></tr>` : ''}
          ${customFieldDefs.filter(cf => customFields[cf.name] !== undefined && customFields[cf.name] !== '').map(cf =>
            `<tr><td style="font-weight:600">${cf.name}</td><td>${cf.dataType === 'boolean' ? (customFields[cf.name] === 'true' ? 'Yes' : 'No') : customFields[cf.name]}</td></tr>`
          ).join('')}
        </tbody>
      </table>`;
      printWindow('Project Details', headerHtml + details, '');
    } catch (err) {
      alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100" title="Print"><Printer className="w-4 h-4" /></button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Code</span>
            <span className="text-slate-900 font-mono col-span-2">{project.code || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Customer</span>
            <span className="text-slate-900 col-span-2">{project.customerName || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Billing Method</span>
            <span className="text-slate-900 col-span-2">{project.billingMethod || 'Fixed Price'}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Status</span>
            <span className="text-slate-900 col-span-2 capitalize">{project.status || 'active'}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Start Date</span>
            <span className="text-slate-900 col-span-2">{fmtDate(project.startDate)}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">End Date</span>
            <span className="text-slate-900 col-span-2">{fmtDate(project.endDate)}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Budget</span>
            <span className="text-slate-900 font-semibold col-span-2">{fmtNaira(project.budget)}</span>
          </div>
          {project.description && (
            <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium col-span-1">Description</span>
              <span className="text-slate-900 col-span-2">{project.description}</span>
            </div>
          )}
          {customFieldDefs.filter(cf => customFields[cf.name] !== undefined && customFields[cf.name] !== '').map((cf, i) => (
            <div key={i} className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium col-span-1">{cf.name}</span>
              <span className="text-slate-900 col-span-2">
                {cf.dataType === 'boolean' ? (customFields[cf.name] === 'true' ? 'Yes' : 'No') : customFields[cf.name]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectForm({
  editTarget, error, isPending, onSave, onClose
}: {
  editTarget: any | null;
  error: string | null;
  isPending: boolean;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const { settings } = useOrgSettings();
  const customFieldDefs: { name: string; dataType: string }[] = settings?.projects?.fields || [];

  const [name, setName] = useState(editTarget?.name || '');
  const [code, setCode] = useState(editTarget?.code || '');
  const [description, setDescription] = useState(editTarget?.description || '');
  const [status, setStatus] = useState(editTarget?.status || 'active');
  const [startDate, setStartDate] = useState(editTarget?.startDate ? new Date(editTarget.startDate).toISOString().split('T')[0] : '');
  const [endDate, setEndDate] = useState(editTarget?.endDate ? new Date(editTarget.endDate).toISOString().split('T')[0] : '');
  const [budget, setBudget] = useState(editTarget ? (editTarget.budget / 100).toString() : '');
  const [customerId, setCustomerId] = useState(editTarget?.customerId || '');
  const [customerName, setCustomerName] = useState(editTarget?.customerName || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [billingMethod, setBillingMethod] = useState(editTarget?.billingMethod || 'Fixed Price');
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    editTarget?.customFields || {}
  );

  const { data: customers = [] } = useQuery({
    queryKey: ['sales', 'customers'],
    queryFn: async () => {
      const res = await api.get('/sales/customers');
      return res.data || [];
    },
  });

  const handleCustomerSearch = (q: string) => {
    setCustomerSearch(q);
    if (!q.trim()) { setCustomerResults([]); return; }
    const list = Array.isArray(customers) ? customers : [];
    const matches = list.filter((c: any) =>
      (c.name || '').toLowerCase().includes(q.toLowerCase()) ||
      (c.customerCode || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 10);
    setCustomerResults(matches);
  };

  const selectCustomer = (c: any) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerSearch(`${c.name} ${c.customerCode ? `(${c.customerCode})` : ''}`);
    setCustomerResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      status,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      budget: budget ? parseFloat(budget) : 0,
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      billingMethod,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{editTarget ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Project Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Code</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="PROJ-001"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 font-mono" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 resize-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Customer</label>
            <div className="relative mt-1">
              <input type="text" value={customerSearch || (customerName ? `${customerName} ${customerId ? '(selected)' : ''}` : '')}
                onChange={e => handleCustomerSearch(e.target.value)}
                placeholder="Search customer..."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              {customerResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1">
                  {customerResults.map((c: any) => (
                    <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700 border-b border-slate-50 last:border-0">
                      <span className="font-medium">{c.name}</span>
                      {c.customerCode && <span className="text-slate-400 ml-2 font-mono text-xs">{c.customerCode}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Billing Method</label>
              <select value={billingMethod} onChange={e => setBillingMethod(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
                {BILLING_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Budget (₦)</label>
              <input type="number" step="0.01" min="0" value={budget} onChange={e => setBudget(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
            </div>
          </div>

          {customFieldDefs.length > 0 && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">Custom Fields</p>
              {customFieldDefs.map((cf, i) => (
                <div key={i}>
                  {cf.dataType === 'boolean' ? (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={customFields[cf.name] === 'true'}
                        onChange={e => setCustomFields((p: any) => ({ ...p, [cf.name]: e.target.checked ? 'true' : 'false' }))}
                        className="rounded border-slate-300 text-indigo-600" />
                      {cf.name}
                    </label>
                  ) : (
                    <>
                      <label className="text-xs font-semibold text-slate-500 uppercase">{cf.name}</label>
                      {cf.dataType === 'date' ? (
                        <input type="date" value={customFields[cf.name] || ''}
                          onChange={e => setCustomFields((p: any) => ({ ...p, [cf.name]: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
                      ) : cf.dataType === 'number' ? (
                        <input type="number" value={customFields[cf.name] || ''}
                          onChange={e => setCustomFields((p: any) => ({ ...p, [cf.name]: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
                      ) : (
                        <input type="text" value={customFields[cf.name] || ''}
                          onChange={e => setCustomFields((p: any) => ({ ...p, [cf.name]: e.target.value }))}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
            <button type="submit" disabled={isPending || !name.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} {editTarget ? 'Update' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}