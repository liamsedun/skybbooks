import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxApi, vatApi } from '../../lib/api';
import {
  Plus, X, Loader2, CheckCircle2, Clock, DollarSign, ReceiptText,
  FileText, Shield, Banknote, FileBarChart, Landmark, AlertTriangle
} from 'lucide-react';

const fmtNaira = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return '₦' + Math.abs(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

type Tab = 'dashboard' | 'paye' | 'itf' | 'stamp-duty' | 'exemptions' | 'firs-reports' | 'vat-multi';

const tabLabels: Record<string, string> = {
  dashboard: 'Dashboard', paye: 'PAYE Schedules', itf: 'ITF Assessments',
  'stamp-duty': 'Stamp Duty', exemptions: 'Exemptions',
  'firs-reports': 'FIRS Reports', 'vat-multi': 'VAT Settings'
};

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] overflow-y-auto p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className || ''}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

export default function TaxEnginePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [msg, setMsg] = useState('');

  // ——— Queries ———
  const { data: dashboard } = useQuery<any>({
    queryKey: ['tax', 'dashboard'],
    queryFn: taxApi.getDashboard,
    enabled: tab === 'dashboard',
  });

  const { data: payeSchedules, isLoading: loadingPaye } = useQuery<any[]>({
    queryKey: ['tax', 'paye-schedules'],
    queryFn: taxApi.getPayeSchedules,
    enabled: tab === 'paye',
  });

  const { data: itfAssessments, isLoading: loadingItf } = useQuery<any[]>({
    queryKey: ['tax', 'itf-assessments'],
    queryFn: taxApi.getItfAssessments,
    enabled: tab === 'itf',
  });

  const { data: stampDutyRecords, isLoading: loadingStamp } = useQuery<any[]>({
    queryKey: ['tax', 'stamp-duty'],
    queryFn: () => taxApi.getStampDuty(),
    enabled: tab === 'stamp-duty',
  });

  const { data: exemptions, isLoading: loadingExemptions } = useQuery<any[]>({
    queryKey: ['tax', 'exemptions'],
    queryFn: () => taxApi.getExemptions(),
    enabled: tab === 'exemptions',
  });

  const { data: firsReports, isLoading: loadingFirs } = useQuery<any[]>({
    queryKey: ['tax', 'firs-reports'],
    queryFn: () => taxApi.getFirsReports(),
    enabled: tab === 'firs-reports',
  });

  const { data: vatSettings } = useQuery<any>({
    queryKey: ['vat', 'settings'],
    queryFn: vatApi.getSettings,
    enabled: tab === 'vat-multi',
  });

  // ——— Mutations ———
  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // Create PAYE schedule
  const [showModal, setShowModal] = useState(false);
  const [payePeriodStart, setPayePeriodStart] = useState('');
  const [payePeriodEnd, setPayePeriodEnd] = useState('');
  const [payeEntries, setPayeEntries] = useState('');

  const createPayeMut = useMutation({
    mutationFn: (data: any) => taxApi.createPayeSchedule(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'paye-schedules'] }); setShowModal(false); notify('PAYE schedule created'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  const postPayeMut = useMutation({
    mutationFn: (id: string) => taxApi.postPayeJournal(id, { date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'paye-schedules'] }); notify('PAYE journal posted'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  // Create ITF
  const [itfYear, setItfYear] = useState(new Date().getFullYear().toString());
  const [itfPayroll, setItfPayroll] = useState(0);

  const createItfMut = useMutation({
    mutationFn: (data: any) => taxApi.createItfAssessment(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'itf-assessments'] }); setShowModal(false); notify('ITF assessment created'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  const postItfMut = useMutation({
    mutationFn: (id: string) => taxApi.postItfJournal(id, { date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'itf-assessments'] }); notify('ITF journal posted'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  // Create Exemption
  const [exTaxType, setExTaxType] = useState('vat');
  const [exType, setExType] = useState('');
  const [exRef, setExRef] = useState('');
  const [exStart, setExStart] = useState('');
  const [exEnd, setExEnd] = useState('');

  const createExMut = useMutation({
    mutationFn: (data: any) => taxApi.createExemption(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'exemptions'] }); setShowModal(false); notify('Exemption created'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  // Generate FIRS report
  const [firsType, setFirsType] = useState('vat');
  const [firsStart, setFirsStart] = useState('');
  const [firsEnd, setFirsEnd] = useState('');
  const [firsYear, setFirsYear] = useState(new Date().getFullYear().toString());

  const genFirsMut = useMutation({
    mutationFn: (data: any) => taxApi.generateFirsReport(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'firs-reports'] }); setShowModal(false); notify('FIRS report generated'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  const fileFirsMut = useMutation({
    mutationFn: (id: string) => taxApi.fileFirsReport(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'firs-reports'] }); notify('Report filed'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  // Stamp duty record
  const [sdType, setSdType] = useState('');
  const [sdAmount, setSdAmount] = useState(0);

  const createSdMut = useMutation({
    mutationFn: (data: any) => taxApi.createStampDuty(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax', 'stamp-duty'] }); setShowModal(false); notify('Stamp duty recorded'); },
    onError: (err: any) => notify(err?.response?.data?.error || 'Failed'),
  });

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <FileBarChart size={15} /> },
    { key: 'paye', label: 'PAYE', icon: <DollarSign size={15} /> },
    { key: 'itf', label: 'ITF', icon: <Shield size={15} /> },
    { key: 'stamp-duty', label: 'Stamp Duty', icon: <Banknote size={15} /> },
    { key: 'exemptions', label: 'Exemptions', icon: <AlertTriangle size={15} /> },
    { key: 'firs-reports', label: 'FIRS Reports', icon: <FileText size={15} /> },
    { key: 'vat-multi', label: 'VAT Settings', icon: <ReceiptText size={15} /> },
  ];

  const renderTable = (cols: string[], rows: any[] | null, loading: boolean, empty: string) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>{cols.map((c, i) => <th key={i} className="text-left px-4 py-3 font-medium text-gray-600">{c}</th>)}</tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={cols.length} className="text-center py-8 text-gray-400"><Loader2 size={20} className="inline animate-spin" /> Loading...</td></tr>
          ) : !rows?.length ? (
            <tr><td colSpan={cols.length} className="text-center py-8 text-gray-400">{empty}</td></tr>
          ) : rows.map((r, idx) => (
            <tr key={r.id ?? idx} className="border-b border-gray-100 hover:bg-gray-50">
              {r.cells?.map((cell: any, ci: number) => (
                <td key={ci} className={`px-4 py-3 ${typeof cell === 'object' ? cell.className || '' : ''}`}>
                  {typeof cell === 'object' ? cell.content : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const statusBadge = (status: string, colors: Record<string, string> = {}) => {
    const color = colors[status] || 'bg-gray-100 text-gray-700';
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>{status}</span>;
  };

  const openNewModal = () => setShowModal(true);

  const fmtCur = (v: number) => fmtNaira(v);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nigerian Tax Engine</h1>
          <p className="text-sm text-gray-500 mt-1">PAYE, NHF, NSITF, ITF, Stamp Duty, FIRS Reports & Tax Exemptions</p>
        </div>
        {tab !== 'dashboard' && tab !== 'vat-multi' && (
          <button onClick={openNewModal} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            <Plus size={18} /> New {tabLabels[tab]}
          </button>
        )}
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-2 hover:bg-indigo-100 rounded p-0.5"><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>{t.icon}{t.label}</button>
        ))}
      </div>

      {/* ===== DASHBOARD ===== */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="VAT Payable" value={fmtCur(dashboard?.vat?.netVatPayable ?? 0)} color="text-red-600" />
            <StatCard label="WHT Payable (Net)" value={fmtCur(dashboard?.wht?.netWhtPayable ?? 0)} color="text-amber-600" />
            <StatCard label="Pending PAYE" value={fmtCur(dashboard?.paye?.pendingPaye ?? 0)} color="text-blue-600" />
            {dashboard?.cit && (
              <StatCard label={`CIT ${dashboard.cit.taxYear}`} value={fmtCur(dashboard.cit.netCitPayable ?? 0)} color="text-purple-600" />
            )}
            <StatCard label="Output VAT" value={fmtCur(dashboard?.vat?.outputVat ?? 0)} color="text-orange-600" />
            <StatCard label="Input VAT" value={fmtCur(dashboard?.vat?.inputVat ?? 0)} color="text-emerald-600" />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Tax Obligations at a Glance</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>VAT – <span className="text-gray-500">Net payable to FIRS</span></span><span className="font-medium">{fmtCur(dashboard?.vat?.netVatPayable ?? 0)}</span></div>
              <div className="flex justify-between"><span>WHT – <span className="text-gray-500">Collected (customer payments)</span></span><span className="font-medium">{fmtCur(dashboard?.wht?.collected ?? 0)}</span></div>
              <div className="flex justify-between"><span>WHT – <span className="text-gray-500">Deducted (vendor payments)</span></span><span className="font-medium">{fmtCur(dashboard?.wht?.deducted ?? 0)}</span></div>
              <div className="flex justify-between"><span>PAYE – <span className="text-gray-500">Computed but not yet remitted</span></span><span className="font-medium">{fmtCur(dashboard?.paye?.pendingPaye ?? 0)} <span className="text-gray-400 text-xs">({dashboard?.paye?.scheduleCount ?? 0} schedules)</span></span></div>
              {dashboard?.cit && (
                <div className="flex justify-between"><span>CIT – <span className="text-gray-500">{dashboard.cit.taxYear}</span></span><span className="font-medium">{fmtCur(dashboard.cit.netCitPayable ?? 0)} ({dashboard.cit.status})</span></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== PAYE ===== */}
      {tab === 'paye' && renderTable(
        ['Period', 'Gross Pay', 'Taxable Pay', 'PAYE', 'NHF', 'NSITF', 'Status', 'Actions'],
        payeSchedules?.map((s: any) => ({
          id: s.id,
          cells: [
            s.periodLabel || `${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}`,
            { content: fmtCur(s.totalGrossPay), className: 'text-right' },
            { content: fmtCur(s.totalTaxablePay), className: 'text-right' },
            { content: fmtCur(s.totalPaye), className: 'text-right font-medium' },
            { content: fmtCur(s.totalNhf), className: 'text-right' },
            { content: fmtCur(s.totalNsitf), className: 'text-right' },
            statusBadge(s.status, { computed: 'bg-blue-100 text-blue-700', posted: 'bg-emerald-100 text-emerald-700', draft: 'bg-gray-100 text-gray-600', remitted: 'bg-purple-100 text-purple-700' }),
            s.status === 'computed' ? <button onClick={() => postPayeMut.mutate(s.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Post JE</button> : '—',
          ],
        })) ?? null,
        loadingPaye, 'No PAYE schedules yet'
      )}

      {/* ===== ITF ===== */}
      {tab === 'itf' && renderTable(
        ['Year', 'Total Payroll', 'Rate', 'Contribution', 'Paid', 'Status', 'Actions'],
        itfAssessments?.map((a: any) => ({
          id: a.id,
          cells: [
            a.assessmentYear,
            { content: fmtCur(a.totalPayroll), className: 'text-right' },
            { content: `${Number(a.contributionRate) * 100}%`, className: 'text-center' },
            { content: fmtCur(a.contributionAmount), className: 'text-right font-medium' },
            { content: fmtCur(a.paidAmount), className: 'text-right' },
            statusBadge(a.status, { paid: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700', waived: 'bg-gray-100 text-gray-600' }),
            a.status === 'pending' ? <button onClick={() => postItfMut.mutate(a.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Post JE</button> : '—',
          ],
        })) ?? null,
        loadingItf, 'No ITF assessments yet'
      )}

      {/* ===== STAMP DUTY ===== */}
      {tab === 'stamp-duty' && renderTable(
        ['Date', 'Transaction Type', 'Reference', 'Gross Amount', 'Stamp Duty', 'Actions'],
        stampDutyRecords?.map((r: any) => ({
          id: r.id,
          cells: [
            fmtDate(r.createdAt),
            r.transactionType,
            r.referenceType || '—',
            { content: fmtCur(r.grossAmount), className: 'text-right' },
            { content: fmtCur(r.stampDutyAmount), className: 'text-right font-medium' },
            '—',
          ],
        })) ?? null,
        loadingStamp, 'No stamp duty records'
      )}

      {/* ===== EXEMPTIONS ===== */}
      {tab === 'exemptions' && renderTable(
        ['Tax Type', 'Exemption Type', 'Reference', 'Start', 'End', 'Status'],
        exemptions?.map((e: any) => ({
          id: e.id,
          cells: [
            (e.taxType || '').toUpperCase(),
            e.exemptionType,
            e.referenceNumber || '—',
            fmtDate(e.startDate),
            e.endDate ? fmtDate(e.endDate) : '—',
            statusBadge(e.status, { active: 'bg-emerald-100 text-emerald-700', expired: 'bg-gray-100 text-gray-600', revoked: 'bg-red-100 text-red-700' }),
          ],
        })) ?? null,
        loadingExemptions, 'No tax exemptions'
      )}

      {/* ===== FIRS REPORTS ===== */}
      {tab === 'firs-reports' && renderTable(
        ['Period', 'Type', 'Tax Year', 'Total Liability', 'Paid', 'Balance', 'Status', 'Actions'],
        firsReports?.map((r: any) => ({
          id: r.id,
          cells: [
            r.periodLabel || `${fmtDate(r.periodStart)} – ${fmtDate(r.periodEnd)}`,
            (r.reportType || '').toUpperCase(),
            r.taxYear || '—',
            { content: fmtCur(r.totalLiability), className: 'text-right font-medium' },
            { content: fmtCur(r.totalPaid), className: 'text-right' },
            { content: fmtCur(r.balanceDue), className: 'text-right' },
            statusBadge(r.status, { draft: 'bg-gray-100 text-gray-600', filed: 'bg-blue-100 text-blue-700', assessed: 'bg-amber-100 text-amber-700', paid: 'bg-emerald-100 text-emerald-700' }),
            r.status === 'draft' ? <button onClick={() => fileFirsMut.mutate(r.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">File</button> : '—',
          ],
        })) ?? null,
        loadingFirs, 'No FIRS reports yet'
      )}

      {/* ===== VAT SETTINGS ===== */}
      {tab === 'vat-multi' && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 max-w-lg">
          <h3 className="text-base font-semibold text-gray-900 mb-3">VAT Configuration</h3>
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">VAT Number:</span> <span className="font-medium ml-2">{vatSettings?.vatNumber || 'Not set'}</span></div>
            <div><span className="text-gray-500">Registered:</span> <span className="font-medium ml-2">{vatSettings?.vatRegistered ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500">Filing Frequency:</span> <span className="font-medium ml-2 capitalize">{vatSettings?.filingFrequency || 'monthly'}</span></div>
            <div><span className="text-gray-500">Standard Rated:</span> <span className="font-medium ml-2">{vatSettings?.hasStandardRated !== false ? 'Yes (7.5%)' : 'No'}</span></div>
            <div><span className="text-gray-500">Zero-Rated:</span> <span className="font-medium ml-2">{vatSettings?.hasZeroRated ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500">Exempt:</span> <span className="font-medium ml-2">{vatSettings?.hasExempt ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500">Reverse Charge:</span> <span className="font-medium ml-2">{vatSettings?.hasReverseCharge ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-500">Filing Type (Org settings):</span> <span className="font-medium ml-2">{vatSettings?.vatRegistered ? 'Full (VAT 7.5%)' : 'Flat/Nil'}</span></div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Configure multi-rate VAT via Settings &gt; Taxes &gt; Tax Rates. VAT return auto-computes from 301300/101600 balances.</p>
        </div>
      )}

      {/* ===== MODALS ===== */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={`New ${tabLabels[tab]}`}>
        {tab === 'paye' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Period Start</label><input type="date" value={payePeriodStart} onChange={e => setPayePeriodStart(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Period End</label><input type="date" value={payePeriodEnd} onChange={e => setPayePeriodEnd(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Employee Entries (JSON array with employeeId and grossPay)</label><textarea value={payeEntries} onChange={e => setPayeEntries(e.target.value)} rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder='[{"employeeId": "uuid", "grossPay": 500000}]' /></div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => {
                try {
                  const entries = JSON.parse(payeEntries);
                  createPayeMut.mutate({ periodStart: payePeriodStart, periodEnd: payePeriodEnd, entries });
                } catch { notify('Invalid JSON entries'); }
              }} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create</button>
            </div>
          </div>
        )}
        {tab === 'itf' && (
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Assessment Year</label><input type="text" value={itfYear} onChange={e => setItfYear(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Total Annual Payroll (kobo)</label><input type="number" value={itfPayroll} onChange={e => setItfPayroll(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createItfMut.mutate({ assessmentYear: itfYear, totalPayroll: itfPayroll })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create</button>
            </div>
          </div>
        )}
        {tab === 'stamp-duty' && (
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Transaction Type</label><input type="text" value={sdType} onChange={e => setSdType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Gross Amount (kobo)</label><input type="number" value={sdAmount} onChange={e => setSdAmount(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createSdMut.mutate({ transactionType: sdType, grossAmount: sdAmount, date: new Date().toISOString().split('T')[0] })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Record</button>
            </div>
          </div>
        )}
        {tab === 'exemptions' && (
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Tax Type</label>
              <select value={exTaxType} onChange={e => setExTaxType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['vat','wht','cit','paye','itf','cgt','edt','stamp_duty','nhf','nsitf','all'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Exemption Type</label><input type="text" value={exType} onChange={e => setExType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g., pioneer_status, export_exemption" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Reference Number</label><input type="text" value={exRef} onChange={e => setExRef(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label><input type="date" value={exStart} onChange={e => setExStart(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">End Date</label><input type="date" value={exEnd} onChange={e => setExEnd(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => createExMut.mutate({ taxType: exTaxType, exemptionType: exType, referenceNumber: exRef || undefined, startDate: exStart, endDate: exEnd || undefined })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create</button>
            </div>
          </div>
        )}
        {tab === 'firs-reports' && (
          <div className="space-y-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Report Type</label>
              <select value={firsType} onChange={e => setFirsType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {['vat','wht','cit','paye','itf','cgt','edt','stamp_duty','consolidated'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Period Start</label><input type="date" value={firsStart} onChange={e => setFirsStart(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Period End</label><input type="date" value={firsEnd} onChange={e => setFirsEnd(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Tax Year (for CIT)</label><input type="text" value={firsYear} onChange={e => setFirsYear(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => genFirsMut.mutate({ reportType: firsType, periodStart: firsStart, periodEnd: firsEnd, taxYear: firsType === 'cit' ? firsYear : undefined })} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Generate</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
