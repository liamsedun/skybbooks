import { useMemo } from 'react';
import { BarChart3, Download, FileText, Users, TrendingUp, Clock, Percent, Target, Briefcase } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';
import { useToast } from '../../../../contexts/ToastContext';

const HEADCOUNT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
const HEADCOUNT_DATA = [142, 148, 153, 158, 162, 170, 176];

const DEPARTMENTS = [
  { name: 'Engineering', count: 48, pct: 27, color: 'bg-blue-500' },
  { name: 'Finance', count: 22, pct: 13, color: 'bg-emerald-500' },
  { name: 'Marketing', count: 18, pct: 10, color: 'bg-purple-500' },
  { name: 'Operations', count: 35, pct: 20, color: 'bg-amber-500' },
  { name: 'HR', count: 12, pct: 7, color: 'bg-rose-500' },
  { name: 'Legal', count: 8, pct: 5, color: 'bg-cyan-500' },
  { name: 'Other', count: 33, pct: 18, color: 'bg-slate-400' },
];

const AGE_GROUPS = [
  { label: '20-25', count: 18, pct: 10, color: 'bg-blue-400' },
  { label: '26-30', count: 52, pct: 29, color: 'bg-emerald-400' },
  { label: '31-35', count: 48, pct: 27, color: 'bg-purple-400' },
  { label: '36-40', count: 28, pct: 16, color: 'bg-amber-400' },
  { label: '41-50', count: 22, pct: 12, color: 'bg-rose-400' },
  { label: '50+', count: 12, pct: 7, color: 'bg-cyan-400' },
];

export function ReportsAnalyticsPage() {
  const { success } = useToast();
  const maxHeadcount = Math.max(...HEADCOUNT_DATA);

  const stats = useMemo(() => [
    { label: 'Total Headcount', value: 176, icon: <Users className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Turnover Rate', value: '12.4%', icon: <TrendingUp className="w-4 h-4" />, color: 'rose' as const },
    { label: 'Avg Tenure', value: '3.8 yrs', icon: <Clock className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Gender Ratio (M:F)', value: '58:42', icon: <Percent className="w-4 h-4" />, color: 'purple' as const },
  ], []);

  const csvHeaders = ['Metric', 'Value'];
  const csvRows = [
    ['Total Headcount', '176'],
    ['Turnover Rate', '12.4%'],
    ['Avg Tenure', '3.8 yrs'],
    ['Gender Ratio (M:F)', '58:42'],
    ['', ''],
    ['Month', 'Headcount'],
    ...HEADCOUNT_MONTHS.map((m, i) => [m, String(HEADCOUNT_DATA[i])]),
    ['', ''],
    ['Department', 'Count', 'Percentage'],
    ...DEPARTMENTS.map(d => [d.name, String(d.count), `${d.pct}%`]),
    ['', ''],
    ['Age Group', 'Count', 'Percentage'],
    ...AGE_GROUPS.map(a => [a.label, String(a.count), `${a.pct}%`]),
  ];

  return (
    <HrPageShell title="Analytics" description="Advanced HR analytics dashboards, trend charts, and data visualisations"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'hr-analytics'); success('CSV exported'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
        <button onClick={() => exportToPdf('HR Analytics', csvHeaders.slice(0, 2), csvRows.slice(0, 5), 'hr-analytics')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
      </>}>
      <HrStatCards items={stats} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Headcount Trend */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Headcount Trend</h3>
            <span className="text-[11px] font-medium text-ink-400">Last 7 months</span>
          </div>
          <div className="flex items-end gap-2 h-40">
            {HEADCOUNT_MONTHS.map((month, i) => {
              const height = (HEADCOUNT_DATA[i] / maxHeadcount) * 100;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-ink-500">{HEADCOUNT_DATA[i]}</span>
                  <div className="w-full bg-primary/10 rounded-t-md relative" style={{ height: `${height}%` }}>
                    <div className="absolute bottom-0 w-full bg-primary rounded-t-md transition-all duration-500" style={{ height: '100%' }} />
                  </div>
                  <span className="text-[10px] text-ink-400">{month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" /> Department Breakdown</h3>
          </div>
          <div className="space-y-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-ink-100 dark:bg-ink-800">
              {DEPARTMENTS.map(d => (
                <div key={d.name} className={`${d.color} transition-all duration-500`} style={{ width: `${d.pct}%` }} title={`${d.name}: ${d.pct}%`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEPARTMENTS.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${d.color}`} />
                    <span className="text-ink-600">{d.name}</span>
                  </div>
                  <span className="font-medium text-ink-800">{d.pct}%</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-ink-400 text-center pt-1">Total: {DEPARTMENTS.reduce((s, d) => s + d.count, 0)} employees</div>
          </div>
        </div>

        {/* Age Distribution */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Age Distribution</h3>
          </div>
          <div className="space-y-2.5">
            {AGE_GROUPS.map(g => (
              <div key={g.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-600">{g.label}</span>
                  <span className="font-medium text-ink-800">{g.count} ({g.pct}%)</span>
                </div>
                <div className="h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${g.color} transition-all duration-500`} style={{ width: `${g.pct * 3}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 content-start">
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
            <div className="flex items-center gap-2 text-ink-400 mb-2"><Target className="w-4 h-4" /><span className="text-xs font-medium">Turnover Rate</span></div>
            <p className="text-2xl font-bold text-ink-900">12.4%</p>
            <p className="text-[11px] text-ink-400 mt-1">-2.1% from last year</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
            <div className="flex items-center gap-2 text-ink-400 mb-2"><Clock className="w-4 h-4" /><span className="text-xs font-medium">Avg Tenure</span></div>
            <p className="text-2xl font-bold text-ink-900">3.8 yrs</p>
            <p className="text-[11px] text-ink-400 mt-1">+0.3 yr from last year</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
            <div className="flex items-center gap-2 text-ink-400 mb-2"><Users className="w-4 h-4" /><span className="text-xs font-medium">Gender Ratio</span></div>
            <p className="text-2xl font-bold text-ink-900">58:42</p>
            <p className="text-[11px] text-ink-400 mt-1">Male : Female</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
            <div className="flex items-center gap-2 text-ink-400 mb-2"><BarChart3 className="w-4 h-4" /><span className="text-xs font-medium">New Hires (YTD)</span></div>
            <p className="text-2xl font-bold text-ink-900">34</p>
            <p className="text-[11px] text-ink-400 mt-1">+8 from same period last yr</p>
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}


