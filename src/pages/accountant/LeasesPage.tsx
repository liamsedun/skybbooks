import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaseApi, accountantApi, printWindow } from '../../lib/api';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { PageLoader } from '../../components/ui/PageLoader';
import { Plus, X, Loader2, Eye, Trash2, FileText, Printer, Ban, ArrowUpDown, CheckCircle, DollarSign, Calendar } from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', active: 'Active', modified: 'Modified', terminated: 'Terminated', expired: 'Expired'
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200/50',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-100/50',
  modified: 'bg-amber-100 text-amber-700 border-amber-100/50',
  terminated: 'bg-red-100 text-red-700 border-red-100/50',
  expired: 'bg-slate-100 text-slate-600 border-slate-200/50',
};

const ASSET_CATEGORIES = ['buildings', 'motor_vehicles', 'equipment', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  buildings: 'Buildings', motor_vehicles: 'Motor Vehicles', equipment: 'Equipment', other: 'Other'
};

export function LeasesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editLease, setEditLease] = useState<any | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: leases, isLoading } = useQuery({
    queryKey: ['leases'],
    queryFn: () => leaseApi.listLeases(),
  });

  const { data: report } = useQuery({
    queryKey: ['lease-report'],
    queryFn: () => leaseApi.getLeaseReport(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leaseApi.updateLease(id, { status: 'terminated' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leases'] }),
  });

  const handlePrintPdf = () => {
    try {
      const list = Array.isArray(leases) ? leases : [];
      const rows = list.map((l: any) =>
        `<tr><td>${l.leaseNumber}</td><td>${l.lessorName}</td><td>${CATEGORY_LABELS[l.assetCategory] || l.assetCategory}</td><td class="r">${fmtNaira(l.paymentAmount)}</td><td class="r">${fmtNaira(l.presentValue)}</td><td class="r">${fmtNaira(l.rouAssetInitial)}</td><td>${fmtDate(l.commencementDate)}</td><td class="c">${(STATUS_LABELS[l.status] || l.status)}</td></tr>`
      ).join('');
      printWindow('Leases Schedule', `<table><thead><tr><th>Lease #</th><th>Lessor</th><th>Category</th><th class="r">Payment</th><th class="r">PV</th><th class="r">ROU Asset</th><th>Commencement</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table>`, `${list.length} leases`);
    } catch (err) {
      alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Lease Accounting (IFRS 16)</h1>
        <div className="flex gap-2">
          <button onClick={handlePrintPdf} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Printer className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200"><Plus className="w-3.5 h-3.5" /> +New Lease</button>
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase">Total Leases</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{report.totalLeases}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase">Active</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{report.activeLeases}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase">ROU Assets</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{fmtNaira(report.totalRouAssetValue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase">Outstanding Liability</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{fmtNaira(report.totalOutstandingLiability)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase">Monthly Payments</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{fmtNaira(report.monthlyPaymentTotal)}</p>
          </div>
        </div>
      )}

      {showForm ? (
        <LeaseForm onDone={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['leases'] }); }} />
      ) : editLease ? (
        <LeaseForm initialData={editLease} onDone={() => { setEditLease(null); queryClient.invalidateQueries({ queryKey: ['leases'] }); }} />
      ) : viewId ? (
        <LeaseDetailView leaseId={viewId} onBack={() => setViewId(null)} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['leases'] })} />
      ) : isLoading ? (
        <PageLoader message="Loading leases..." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left">Lease #</th>
                <th className="px-3 py-3 text-left">Lessor</th>
                <th className="px-3 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-right">Payment</th>
                <th className="px-3 py-3 text-right">PV</th>
                <th className="px-3 py-3 text-right">ROU Asset</th>
                <th className="px-3 py-3 text-left">Commencement</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const list = Array.isArray(leases) ? leases : [];
                if (list.length === 0) return <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No leases recorded.</td></tr>;
                return list.map((l: any) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                    <td className="px-3 py-2 font-mono font-medium text-slate-800">{l.leaseNumber}</td>
                    <td className="px-3 py-2 text-slate-800">{l.lessorName}</td>
                    <td className="px-3 py-2 text-slate-600">{CATEGORY_LABELS[l.assetCategory] || l.assetCategory}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(l.paymentAmount)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(l.presentValue)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(l.rouAssetInitial)}</td>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(l.commencementDate)}</td>
                    <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[l.status] || STATUS_COLORS.draft}`}>{STATUS_LABELS[l.status] || l.status}</span></td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setViewId(l.id)} className="text-blue-600 hover:text-blue-800"><Eye className="w-3.5 h-3.5" /></button>
                        {l.status === 'active' || l.status === 'modified' ? (
                          <button onClick={() => { if (confirm('Terminate this lease?')) deleteMutation.mutate(l.id); }} className="text-red-500 hover:text-red-700"><Ban className="w-3.5 h-3.5" /></button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeaseDetailView({ leaseId, onBack, onRefresh }: { leaseId: string; onBack: () => void; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const [processingPayment, setProcessingPayment] = useState(false);
  const [postingDepr, setPostingDepr] = useState(false);
  const [postingCommencement, setPostingCommencement] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [showTerminate, setShowTerminate] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchDepr, setBatchDepr] = useState(false);

  const { data: lease, isLoading, refetch } = useQuery({
    queryKey: ['lease', leaseId],
    queryFn: () => leaseApi.getLease(leaseId),
  });

  const handlePostCommencement = async () => {
    setPostingCommencement(true);
    try {
      await leaseApi.postCommencement(leaseId);
      await refetch();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Failed to post commencement entry');
    } finally { setPostingCommencement(false); }
  };

  const handleProcessPayment = async (periodNumber: number) => {
    setProcessingPayment(true);
    try {
      await leaseApi.processPayment(leaseId, periodNumber);
      await refetch();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Failed to process payment');
    } finally { setProcessingPayment(false); }
  };

  const handlePostDepreciation = async (periodNumber: number) => {
    setPostingDepr(true);
    try {
      await leaseApi.postDepreciation(leaseId, periodNumber);
      await refetch();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Failed to post depreciation');
    } finally { setPostingDepr(false); }
  };

  const handleBatchProcessPayments = async () => {
    setBatchProcessing(true);
    try {
      await leaseApi.batchProcessPayments(leaseId);
      await refetch();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Failed to batch process payments');
    } finally { setBatchProcessing(false); }
  };

  const handleBatchPostDepreciation = async () => {
    setBatchDepr(true);
    try {
      await leaseApi.batchPostDepreciation(leaseId);
      await refetch();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Failed to batch post depreciation');
    } finally { setBatchDepr(false); }
  };

  if (isLoading) return <PageLoader message="Loading lease details..." />;
  if (!lease) return <div className="text-center py-20 text-slate-400">Lease not found.</div>;

  const schedule = lease.schedule || [];
  const unpaidCount = schedule.filter((s: any) => !s.isPaid).length;
  const paidCount = schedule.filter((s: any) => s.isPaid).length;

  const hasCommencement = lease.leaseJournalEntries?.some((e: any) => e.entryType === 'commencement') ||
    lease.leaseJournalEntries?.some((e: any) => e.entryType === 'commencement');

  // Check via leaseJournalEntries if available, else check schedule
  const commencementPosted = schedule.length > 0; // schedule only exists if lease was created with commencement

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to leases</button>
        <div className="flex gap-2">
          {(lease.status === 'active' || lease.status === 'modified') && (
            <>
              <button onClick={() => setShowModify(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-all duration-200"><ArrowUpDown className="w-3.5 h-3.5" /> Modify</button>
              <button onClick={() => setShowTerminate(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all duration-200"><Ban className="w-3.5 h-3.5" /> Terminate</button>
            </>
          )}
        </div>
      </div>

      {/* Lease Summary */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{lease.leaseNumber}</h2>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[lease.status] || STATUS_COLORS.draft}`}>{STATUS_LABELS[lease.status] || lease.status}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Lessor</span><p className="text-sm font-medium text-slate-800">{lease.lessorName}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Category</span><p className="text-sm text-slate-600">{CATEGORY_LABELS[lease.assetCategory] || lease.assetCategory}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Commencement</span><p className="text-sm text-slate-600">{fmtDate(lease.commencementDate)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">End Date</span><p className="text-sm text-slate-600">{fmtDate(lease.endDate)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Term (months)</span><p className="text-sm text-slate-600">{lease.leaseTermMonths}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Payment Amount</span><p className="text-sm font-semibold text-slate-800">{fmtNaira(lease.paymentAmount)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Present Value</span><p className="text-sm font-semibold text-slate-800">{fmtNaira(lease.presentValue)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Interest Rate</span><p className="text-sm text-slate-600">{lease.incrementalBorrowingRate}%</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">ROU Asset (Initial)</span><p className="text-sm font-semibold text-slate-800">{fmtNaira(lease.rouAssetInitial)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Initial Direct Costs</span><p className="text-sm text-slate-600">{fmtNaira(lease.initialDirectCosts)}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Total Payments</span><p className="text-sm text-slate-600">{lease.totalPayments}</p></div>
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Frequency</span><p className="text-sm text-slate-600 capitalize">{lease.paymentFrequency}</p></div>
        </div>
        {lease.notes && (
          <div><span className="text-xs font-semibold text-slate-500 uppercase">Notes</span><p className="text-sm text-slate-600 mt-1">{lease.notes}</p></div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {lease.status === 'active' && (
            <button onClick={handlePostCommencement} disabled={postingCommencement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all duration-200">
              {postingCommencement ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Post Commencement JE
            </button>
          )}
          {(lease.status === 'active' || lease.status === 'modified') && unpaidCount > 0 && (
            <>
              <button onClick={handleBatchProcessPayments} disabled={batchProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all duration-200">
                {batchProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />} Process All Payments ({unpaidCount})
              </button>
              <button onClick={handleBatchPostDepreciation} disabled={batchDepr}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all duration-200">
                {batchDepr ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />} Post All Depreciation
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payment Schedule */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Payment Schedule</h3>
          <span className="text-xs text-slate-400">{paidCount} paid / {schedule.length} total</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Due Date</th>
              <th className="px-3 py-2 text-right">Payment</th>
              <th className="px-3 py-2 text-right">Interest</th>
              <th className="px-3 py-2 text-right">Principal</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedule.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No schedule generated.</td></tr>
            ) : schedule.map((s: any) => (
              <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors border-b border-slate-50 ${s.isPaid ? 'bg-emerald-50/30' : ''}`}>
                <td className="px-3 py-2 font-mono font-medium text-slate-800">{s.periodNumber}</td>
                <td className="px-3 py-2 text-slate-600">{fmtDate(s.dueDate)}</td>
                <td className="px-3 py-2 text-right text-slate-800 font-medium">{fmtNaira(s.paymentAmount)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(s.interestAmount)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(s.principalAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmtNaira(s.outstandingBalance)}</td>
                <td className="px-3 py-2 text-center">
                  {s.isPaid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-100/50">
                      <CheckCircle className="w-2.5 h-2.5" /> Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-100/50">Pending</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {!s.isPaid && (lease.status === 'active' || lease.status === 'modified') && (
                      <>
                        <button onClick={() => handleProcessPayment(s.periodNumber)} disabled={processingPayment}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all duration-200">
                          <DollarSign className="w-2.5 h-2.5" /> Pay
                        </button>
                        <button onClick={() => handlePostDepreciation(s.periodNumber)} disabled={postingDepr}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all duration-200">
                          <Calendar className="w-2.5 h-2.5" /> Depr
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {schedule.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <td colSpan={2} className="px-3 py-2 text-xs font-bold text-slate-800">Total</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(schedule.reduce((s: number, p: any) => s + p.paymentAmount, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(schedule.reduce((s: number, p: any) => s + p.interestAmount, 0))}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtNaira(schedule.reduce((s: number, p: any) => s + p.principalAmount, 0))}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModify && (
        <ModifyLeaseModal lease={lease} onClose={() => setShowModify(false)} onDone={() => { setShowModify(false); refetch(); onRefresh(); }} />
      )}
      {showTerminate && (
        <TerminateLeaseModal lease={lease} onClose={() => setShowTerminate(false)} onDone={() => { setShowTerminate(false); refetch(); onRefresh(); }} />
      )}
    </div>
  );
}

function ModifyLeaseModal({ lease, onClose, onDone }: { lease: any; onClose: () => void; onDone: () => void }) {
  const [newPaymentAmount, setNewPaymentAmount] = useState(String(lease.paymentAmount / 100));
  const [newTermMonths, setNewTermMonths] = useState(String(lease.leaseTermMonths));
  const [newTotalPayments, setNewTotalPayments] = useState(String(lease.totalPayments));
  const [newBorrowingRate, setNewBorrowingRate] = useState(String(lease.incrementalBorrowingRate));
  const [modificationDate, setModificationDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!description.trim()) { setError('Description is required'); return; }
    setSubmitting(true);
    try {
      await leaseApi.modifyLease(lease.id, {
        newPaymentAmount: Math.round(Number(newPaymentAmount || 0) * 100),
        newTermMonths: Number(newTermMonths),
        newTotalPayments: Number(newTotalPayments),
        newBorrowingRate: Number(newBorrowingRate),
        modificationDate,
        description: description.trim(),
      });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Modification failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Modify Lease — {lease.leaseNumber}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-500 uppercase">New Payment Amount (₦)</label><input type="number" value={newPaymentAmount} onChange={e => setNewPaymentAmount(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" /></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase">New Term (months)</label><input type="number" value={newTermMonths} onChange={e => setNewTermMonths(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" /></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase">New Total Payments</label><input type="number" value={newTotalPayments} onChange={e => setNewTotalPayments(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" /></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase">New Rate (%)</label><input type="number" step="0.01" value={newBorrowingRate} onChange={e => setNewBorrowingRate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" /></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase">Modification Date</label><input type="date" value={modificationDate} onChange={e => setModificationDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" /></div>
          </div>
          <div><label className="text-xs font-semibold text-slate-500 uppercase">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" placeholder="Reason for modification..." /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-50">{submitting ? 'Submitting...' : 'Modify Lease'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TerminateLeaseModal({ lease, onClose, onDone }: { lease: any; onClose: () => void; onDone: () => void }) {
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await leaseApi.terminateLease(lease.id, terminationDate);
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Termination failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200/80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Terminate Lease — {lease.leaseNumber}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80">{error}</div>}
        <p className="text-sm text-slate-600">This will derecognize the ROU asset and lease liability, recognizing any gain or loss on termination.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="text-xs font-semibold text-slate-500 uppercase">Termination Date</label><input type="date" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200/80 rounded-xl text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50">{submitting ? 'Processing...' : 'Terminate Lease'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeaseForm({ initialData, onDone }: { initialData?: any; onDone: () => void }) {
  const isEdit = !!initialData;
  const [lessorName, setLessorName] = useState(initialData?.lessorName || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [assetCategory, setAssetCategory] = useState(initialData?.assetCategory || 'buildings');
  const [commencementDate, setCommencementDate] = useState(initialData?.commencementDate ? new Date(initialData.commencementDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(initialData?.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '');
  const [leaseTermMonths, setLeaseTermMonths] = useState(String(initialData?.leaseTermMonths || '36'));
  const [paymentAmount, setPaymentAmount] = useState(initialData ? String(initialData.paymentAmount / 100) : '');
  const [paymentFrequency, setPaymentFrequency] = useState(initialData?.paymentFrequency || 'monthly');
  const [totalPayments, setTotalPayments] = useState(String(initialData?.totalPayments || '36'));
  const [incrementalBorrowingRate, setIncrementalBorrowingRate] = useState(String(initialData?.incrementalBorrowingRate || '12'));
  const [initialDirectCosts, setInitialDirectCosts] = useState(initialData ? String(initialData.initialDirectCosts / 100) : '0');
  const [residualValue, setResidualValue] = useState(initialData ? String(initialData.residualValue / 100) : '0');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [rouAssetAccountId, setRouAssetAccountId] = useState(initialData?.rouAssetAccountId || '');
  const [accumDepreciationAccountId, setAccumDepreciationAccountId] = useState(initialData?.accumDepreciationAccountId || '');
  const [depreciationExpenseAccountId, setDepreciationExpenseAccountId] = useState(initialData?.depreciationExpenseAccountId || '');
  const [leaseLiabilityAccountId, setLeaseLiabilityAccountId] = useState(initialData?.leaseLiabilityAccountId || '');
  const [interestExpenseAccountId, setInterestExpenseAccountId] = useState(initialData?.interestExpenseAccountId || '');
  const [bankAccountId, setBankAccountId] = useState(initialData?.bankAccountId || '');
  const [error, setError] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountantApi.getAccounts(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) return leaseApi.updateLease(initialData.id, data);
      return leaseApi.createLease(data);
    },
    onSuccess: onDone,
    onError: (err: any) => setError(err?.response?.data?.error || err?.message || (isEdit ? 'Failed to update lease' : 'Failed to create lease')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!lessorName || !rouAssetAccountId || !accumDepreciationAccountId || !depreciationExpenseAccountId || !paymentAmount || !endDate) {
      setError('Lessor name, ROU asset account, accumulated depreciation account, depreciation expense account, payment amount, and end date are required.');
      return;
    }
    mutation.mutate({
      lessorName,
      description: description || undefined,
      assetCategory,
      commencementDate,
      endDate,
      leaseTermMonths: Number(leaseTermMonths),
      paymentAmount: Math.round(Number(paymentAmount || 0) * 100),
      paymentFrequency,
      totalPayments: Number(totalPayments),
      incrementalBorrowingRate: Number(incrementalBorrowingRate),
      initialDirectCosts: Math.round(Number(initialDirectCosts || 0) * 100),
      residualValue: Math.round(Number(residualValue || 0) * 100),
      notes: notes || undefined,
      rouAssetAccountId,
      accumDepreciationAccountId,
      depreciationExpenseAccountId,
      leaseLiabilityAccountId: leaseLiabilityAccountId || undefined,
      interestExpenseAccountId: interestExpenseAccountId || undefined,
      bankAccountId: bankAccountId || undefined,
    });
  };

  const accList = Array.isArray(accounts) ? accounts : [];
  const assetAccs = accList.filter((a: any) => a.type === 'asset');
  const liabAccs = accList.filter((a: any) => a.type === 'liability');
  const expenseAccs = accList.filter((a: any) => a.type === 'expense');
  const bankAccs = accList.filter((a: any) => a.type === 'asset' && (a.subType === 'Bank' || a.subType === 'Cash'));

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Lease' : 'New Lease'}</h2>
      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100/80"><span>⚠</span> {error}</div>}

      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Lease Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Lessor Name</label>
            <input value={lessorName} onChange={e => setLessorName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Asset Category</label>
            <select value={assetCategory} onChange={e => setAssetCategory(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1">
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Payment Frequency</label>
            <select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semi_annual">Semi-Annual</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Commencement Date</label>
            <input type="date" value={commencementDate} onChange={e => setCommencementDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Term (months)</label>
            <input type="number" value={leaseTermMonths} onChange={e => setLeaseTermMonths(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Total Payments</label>
            <input type="number" value={totalPayments} onChange={e => setTotalPayments(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Financial Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Payment Amount (₦)</label>
            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Borrowing Rate (%)</label>
            <input type="number" step="0.01" value={incrementalBorrowingRate} onChange={e => setIncrementalBorrowingRate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Initial Direct Costs (₦)</label>
            <input type="number" value={initialDirectCosts} onChange={e => setInitialDirectCosts(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Residual Value (₦)</label>
            <input type="number" value={residualValue} onChange={e => setResidualValue(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Account Mapping</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">ROU Asset Account</label>
            <AccountSearchSelect accounts={assetAccs} value={rouAssetAccountId} onChange={setRouAssetAccountId} placeholder="Select account" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Accum. Depreciation Account</label>
            <AccountSearchSelect accounts={assetAccs} value={accumDepreciationAccountId} onChange={setAccumDepreciationAccountId} placeholder="Select account" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Depreciation Expense Account</label>
            <AccountSearchSelect accounts={expenseAccs} value={depreciationExpenseAccountId} onChange={setDepreciationExpenseAccountId} placeholder="Select account" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Lease Liability Account</label>
            <AccountSearchSelect accounts={liabAccs} value={leaseLiabilityAccountId} onChange={setLeaseLiabilityAccountId} placeholder="Select account" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Interest Expense Account</label>
            <AccountSearchSelect accounts={expenseAccs} value={interestExpenseAccountId} onChange={setInterestExpenseAccountId} placeholder="Select account" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Bank/Cash Account</label>
            <AccountSearchSelect accounts={bankAccs} value={bankAccountId} onChange={setBankAccountId} placeholder="Select account" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 mt-1" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 border border-slate-200/80">Cancel</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} {isEdit ? 'Update Lease' : 'Create Lease'}
        </button>
      </div>
    </form>
  );
}
