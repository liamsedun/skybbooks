import { useState, useEffect, useMemo } from 'react';
import { Info, Users, Download, FileText, Search } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { HrViewDrawer } from '../../../../components/hr/HrViewDrawer';
import { HrFilterBar } from '../../../../components/hr/HrFilterBar';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';
import { hrApi } from '../../../../lib/api';

export function EmployeeInformationPage() {
  const [empData, setEmpData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => { hrApi.getReportEmployees().then(r => { setEmpData(r.data); setLoading(false); }); }, []);

  const employees = useMemo(() => {
    const rows = empData?.employees || [];
    if (!search) return rows;
    return rows.filter((r: any) =>
      `${r.hr_employees?.firstName || ''} ${r.hr_employees?.lastName || ''}`.toLowerCase().includes(search.toLowerCase()));
  }, [empData, search]);

  const stats = useMemo(() => [
    { label: 'Total Employees', value: empData?.total || 0, icon: Users, color: 'blue' as const },
    { label: 'Active', value: empData?.activeCount || 0, icon: Users, color: 'green' as const },
    { label: 'New This Month', value: empData?.newHires || 0, icon: Users, color: 'purple' as const },
    { label: 'Departments', value: empData?.byDepartment?.length || 0, icon: Info, color: 'amber' as const },
  ], [empData]);

  const columns: Column<any>[] = [
    { key: 'name', label: 'Name', render: r => `${r.hr_employees?.firstName || ''} ${r.hr_employees?.lastName || ''}`.trim() || '-', className: 'font-medium' },
    { key: 'email', label: 'Email', render: r => r.hr_employees?.email || '-', hideOnMobile: true },
    { key: 'dept', label: 'Department', render: r => r.hr_departments?.name || '-' },
    { key: 'status', label: 'Status', render: r => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.hr_employees?.employmentStatus === 'active' ? 'bg-green-50 text-green-700' : 'bg-ink-100 text-ink-500'}`}>{r.hr_employees?.employmentStatus || '-'}</span> },
    { key: 'gender', label: 'Gender', render: r => r.hr_employees?.gender || '-', hideOnMobile: true },
  ];

  const exportData = () => {
    const headers = ['Name', 'Email', 'Department', 'Status', 'Gender', 'Phone', 'Join Date'];
    const rows = (empData?.employees || []).map((e: any) => [
      `${e.hr_employees?.firstName || ''} ${e.hr_employees?.lastName || ''}`,
      e.hr_employees?.email || '', e.hr_departments?.name || '', e.hr_employees?.employmentStatus || '',
      e.hr_employees?.gender || '', e.hr_employees?.phone || '', e.hr_employees?.joinDate?.toLocaleDateString() || '',
    ]);
    exportToCsv(headers, rows, 'employee-information');
  };

  const viewDetail = async (row: any) => {
    const id = row.hr_employees?.id || row.id;
    try {
      const r = await hrApi.getReportEmployeeDetail(id);
      setSelected(r.data);
    } catch { setSelected(row); }
  };

  return (
    <HrPageShell title="Employee Information" description="Employee directory and headcount reports"
      headerActions={
        <div className="flex gap-1">
          <button onClick={exportData} className="p-1.5 rounded-lg hover:bg-ink-50" title="Export CSV"><Download className="w-4 h-4" /></button>
          <button onClick={() => { const h = ['Department', 'Count']; const r = (empData?.byDepartment || []).map((d: any) => [d.department || 'Unknown', String(d.count)]); exportToPdf('Departments', h, r, 'hr-departments'); }} className="p-1.5 rounded-lg hover:bg-ink-50" title="Export PDF"><FileText className="w-4 h-4" /></button>
        </div>
      }>
      {!loading && <HrStatCards items={stats} columns={4} />}
      <HrFilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search employees..." />
      <HrDataTable columns={columns} data={employees} keyExtractor={r => r.hr_employees?.id || r.id}
        loading={loading} emptyMessage="No employees found" onRowClick={viewDetail} />

      <HrViewDrawer open={!!selected} onClose={() => setSelected(null)} title="Employee Details">
        {selected && (
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-ink-400">Name:</span> <span className="font-medium">{`${selected.hr_employees?.firstName || selected.employee?.firstName || ''} ${selected.hr_employees?.lastName || selected.employee?.lastName || ''}`}</span></div>
              <div><span className="text-ink-400">Email:</span> <span>{selected.hr_employees?.email || selected.employee?.email || '-'}</span></div>
              <div><span className="text-ink-400">Department:</span> <span>{selected.hr_departments?.name || selected.employee?.departments?.name || '-'}</span></div>
              <div><span className="text-ink-400">Status:</span> <span className="capitalize">{selected.hr_employees?.employmentStatus || selected.employee?.employmentStatus || '-'}</span></div>
              <div><span className="text-ink-400">Phone:</span> <span>{selected.hr_employees?.phone || selected.employee?.phone || '-'}</span></div>
              <div><span className="text-ink-400">Join Date:</span> <span>{selected.hr_employees?.joinDate || selected.employee?.joinDate ? new Date(selected.hr_employees?.joinDate || selected.employee?.joinDate).toLocaleDateString() : '-'}</span></div>
            </div>
            {selected.leaveSummary && selected.leaveSummary.length > 0 && (
              <div><h4 className="font-semibold text-ink-700 mb-2">Leave Balances</h4>
                <div className="space-y-1">{selected.leaveSummary.map((l: any) => <div key={l.leaveTypeId} className="flex justify-between text-xs"><span>{l.leaveTypeId}</span><span>{l.usedDays}/{l.totalDays} used</span></div>)}</div>
              </div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}
