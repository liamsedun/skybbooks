import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalApi } from '../../lib/api';
import { Shield, Loader2, CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

const MODULES = [
  { value: 'bills', label: 'Bills' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'journals', label: 'Journals' },
  { value: 'payments_received', label: 'Payments Received' },
  { value: 'payments_made', label: 'Payments Made' },
  { value: 'purchase_orders', label: 'Purchase Orders' },
  { value: 'fixed_assets', label: 'Fixed Assets' },
  { value: 'inventory_adjustments', label: 'Inventory Adjustments' },
];

const LEVELS = [
  { value: 1, label: 'Level 1 — Maker → Poster', desc: 'No review or approval needed. Creators post directly.' },
  { value: 2, label: 'Level 2 — Maker → Approver → Poster', desc: 'Requires approval by an accountant/owner before posting.' },
  { value: 3, label: 'Level 3 — Maker → Reviewer → Approver → Poster', desc: 'Full workflow with review, approval, and posting steps.' },
];

export default function ApprovalWorkflowsPage() {
  const queryClient = useQueryClient();
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['approval-workflows'],
    queryFn: approvalApi.getWorkflows,
  });

  const saveMutation = useMutation({
    mutationFn: ({ module, level }: { module: string; level: number }) =>
      approvalApi.setWorkflow(module, level),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
      setEditingModule(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (module: string) => approvalApi.deleteWorkflow(module),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
    },
  });

  function getLevelForModule(module: string): number {
    return workflows?.find((w: any) => w.module === module)?.level ?? 1;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <Shield className="w-6 h-6 text-slate-400" />
          Approval Workflows
        </h1>
        <p className="text-sm text-slate-500 mt-1 ml-0">
          Configure approval levels for each module. Maker → Reviewer → Approver → Poster workflow.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-medium mb-1">How approval workflows work:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Maker</strong> creates records as drafts and submits them for review.</li>
            <li><strong>Reviewer</strong> (accountant/admin/owner) checks and passes to approval.</li>
            <li><strong>Approver</strong> (accountant/admin/owner) gives final approval.</li>
            <li><strong>Poster</strong> (accountant/admin/owner) posts to the general ledger.</li>
          </ul>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading...
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Module</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Level</th>
                <th className="text-right px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod) => {
                const level = getLevelForModule(mod.value);
                const isEditing = editingModule === mod.value;
                return (
                  <tr key={mod.value} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-4 font-medium text-slate-800">{mod.label}</td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <select
                          value={selectedLevel}
                          onChange={(e) => setSelectedLevel(Number(e.target.value))}
                          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
                        >
                          {LEVELS.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-600">
                          {level === 1 ? 'Level 1 — Direct Post' : level === 2 ? 'Level 2 — With Approval' : 'Level 3 — Full Workflow'}
                        </span>
                      )}
                      {isEditing && (
                        <p className="text-[10px] text-slate-400 mt-1">{LEVELS.find(l => l.value === selectedLevel)?.desc}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => saveMutation.mutate({ module: mod.value, level: selectedLevel })}
                            disabled={saveMutation.isPending}
                            className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {saveMutation.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingModule(null)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditingModule(mod.value); setSelectedLevel(level); }}
                            className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            Edit
                          </button>
                          {level > 1 && (
                            <button
                              onClick={() => { if (confirm('Reset this module to Level 1 (direct posting)?')) deleteMutation.mutate(mod.value); }}
                              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-500 transition"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
