import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, api } from '../../lib/api';
import { PageLoader } from '../../components/ui/PageLoader';
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2, Briefcase, Search, Trash2, Edit3, Eye
} from 'lucide-react';

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

  const filteredProjects = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-indigo-600" /> Projects
        </h1>
        <button onClick={() => { setShowForm(true); setEditTarget(null); setFormError(null); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
          <Plus className="w-4 h-4" /> New Project
        </button>
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
          <input type="text" placeholder="Search by name, code, description..." value={search}
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
      {viewTarget && <ProjectDetailView project={viewTarget} onClose={() => setViewTarget(null)} />}

      {/* Projects Table */}
      {isLoading ? (
        <PageLoader message="Loading projects..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Project</th>
                <th className="px-3 py-3 text-left">Code</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Start Date</th>
                <th className="px-3 py-3 text-left">End Date</th>
                <th className="px-3 py-3 text-right">Budget</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{p.code || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      p.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                      p.status === 'completed' ? 'bg-blue-50 text-blue-700 border border-blue-200/50' :
                      p.status === 'on_hold' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                      'bg-slate-50 text-slate-500 border border-slate-200/50'
                    }`}>{p.status || 'active'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(p.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(p.endDate)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{fmtNaira(p.budget)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectDetailView({ project, onClose }: { project: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-100">
            <span className="text-slate-500 font-medium col-span-1">Code</span>
            <span className="text-slate-900 font-mono col-span-2">{project.code || '—'}</span>
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
  const [name, setName] = useState(editTarget?.name || '');
  const [code, setCode] = useState(editTarget?.code || '');
  const [description, setDescription] = useState(editTarget?.description || '');
  const [status, setStatus] = useState(editTarget?.status || 'active');
  const [startDate, setStartDate] = useState(editTarget?.startDate ? new Date(editTarget.startDate).toISOString().split('T')[0] : '');
  const [endDate, setEndDate] = useState(editTarget?.endDate ? new Date(editTarget.endDate).toISOString().split('T')[0] : '');
  const [budget, setBudget] = useState(editTarget ? (editTarget.budget / 100).toString() : '');

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
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
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

          <div className="grid grid-cols-3 gap-4">
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
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Budget (₦)</label>
            <input type="number" step="0.01" min="0" value={budget} onChange={e => setBudget(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1" />
          </div>

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