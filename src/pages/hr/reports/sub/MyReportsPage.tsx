import { useState, useEffect, useMemo } from 'react';
import { FileBarChart, Download, FileText, ExternalLink } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { hrApi } from '../../../../lib/api';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';

const QUICK_REPORTS = [
  { name: 'Employee Report', type: 'employees', icon: FileBarChart },
  { name: 'Leave Report', type: 'leave', icon: FileBarChart },
  { name: 'Attendance Report', type: 'attendance', icon: FileBarChart },
  { name: 'Performance Report', type: 'performance', icon: FileBarChart },
  { name: 'Compensation Report', type: 'compensation', icon: FileBarChart },
  { name: 'Turnover Report', type: 'turnover', icon: FileBarChart },
  { name: 'Recruitment Report', type: 'recruitment', icon: FileBarChart },
  { name: 'Travel Report', type: 'travel', icon: FileBarChart },
];

export function MyReportsPage() {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { hrApi.getScheduledReports().then(r => { setScheduled(r.data || []); setLoading(false); }); }, []);

  const handleExport = async (type: string, name: string) => {
    try {
      const r = await hrApi.getReportExport(type);
      const { headers, rows } = r.data || r;
      exportToCsv(headers, rows, name);
    } catch { /* ignore */ }
  };

  const handlePdf = async (type: string, name: string) => {
    try {
      const r = await hrApi.getReportExport(type);
      const { headers, rows, title } = r.data || r;
      exportToPdf(title || name, headers, rows, name);
    } catch { /* ignore */ }
  };

  const schedCols: Column<any>[] = [
    { key: 'name', label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'type', label: 'Type', render: r => <span className="capitalize text-xs bg-ink-100 px-2 py-0.5 rounded-full">{r.reportType}</span> },
    { key: 'frequency', label: 'Frequency', render: r => <span className="capitalize text-xs">{r.frequency}</span> },
    { key: 'format', label: 'Format', render: r => <span className="uppercase text-xs font-mono">{r.format}</span> },
    { key: 'active', label: 'Active', render: r => r.isActive ? <span className="text-xs text-green-600">Yes</span> : <span className="text-xs text-ink-400">No</span> },
  ];

  return (
    <HrPageShell title="My Reports" description="Quick access and scheduled reports">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_REPORTS.map(r => (
          <div key={r.type} className="bg-surface rounded-2xl border border-border-custom shadow-sm p-4 hover:shadow-md transition-shadow">
            <r.icon className="w-6 h-6 text-primary mb-2" />
            <p className="text-sm font-medium text-ink-700">{r.name}</p>
            <div className="flex gap-1 mt-2">
              <button onClick={() => handleExport(r.type, r.name)} className="p-1 rounded hover:bg-ink-50" title="CSV"><Download className="w-3.5 h-3.5 text-ink-400" /></button>
              <button onClick={() => handlePdf(r.type, r.name)} className="p-1 rounded hover:bg-ink-50" title="PDF"><FileText className="w-3.5 h-3.5 text-ink-400" /></button>
            </div>
          </div>
        ))}
      </div>

      {scheduled.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ink-700 mb-3">Scheduled Reports</h3>
          <HrDataTable columns={schedCols} data={scheduled} keyExtractor={r => r.id} loading={loading} />
        </div>
      )}
    </HrPageShell>
  );
}
