import { useState, useMemo } from 'react';
import { Clock, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useHrPageState } from '../../../../hooks/useHrPageState';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../../lib/hrExport';
import { useToast } from '../../../../contexts/ToastContext';

interface AttendanceSummary {
  id: string;
  employeeName: string;
  month: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

const MOCK: AttendanceSummary[] = [
  { id: 'AT-001', employeeName: 'Amara Okafor', month: '2026-07', present: 20, absent: 1, late: 1, total: 22 },
  { id: 'AT-002', employeeName: 'Chidi Nwosu', month: '2026-07', present: 18, absent: 2, late: 2, total: 22 },
  { id: 'AT-003', employeeName: 'Fatima Usman', month: '2026-07', present: 22, absent: 0, late: 0, total: 22 },
  { id: 'AT-004', employeeName: 'Emeka Eze', month: '2026-07', present: 19, absent: 1, late: 2, total: 22 },
  { id: 'AT-005', employeeName: 'Yetunde Bello', month: '2026-07', present: 21, absent: 0, late: 1, total: 22 },
  { id: 'AT-006', employeeName: 'Segun Adeyemi', month: '2026-07', present: 15, absent: 5, late: 2, total: 22 },
  { id: 'AT-007', employeeName: 'Ngozi Obi', month: '2026-07', present: 20, absent: 1, late: 1, total: 22 },
  { id: 'AT-008', employeeName: 'Ibrahim Danjuma', month: '2026-07', present: 22, absent: 0, late: 0, total: 22 },
  { id: 'AT-009', employeeName: 'Chioma Adeleke', month: '2026-06', present: 19, absent: 2, late: 1, total: 22 },
  { id: 'AT-010', employeeName: 'Tunde Bakare', month: '2026-06', present: 17, absent: 3, late: 2, total: 22 },
  { id: 'AT-011', employeeName: 'Amara Okafor', month: '2026-06', present: 21, absent: 0, late: 1, total: 22 },
  { id: 'AT-012', employeeName: 'Chidi Nwosu', month: '2026-06', present: 20, absent: 1, late: 1, total: 22 },
];

export function ReportsAttendancePage() {
  const { success } = useToast();
  const [localData, setLocalData] = useState<AttendanceSummary[]>(MOCK);
  const ps = useHrPageState({ data: localData, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'month'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Records', value: localData.length, icon: <Clock className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Present Days', value: localData.reduce((s, i) => s + i.present, 0), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Absent Days', value: localData.reduce((s, i) => s + i.absent, 0), icon: <XCircle className="w-4 h-4" />, color: 'rose' as const },
    { label: 'Late Arrivals', value: localData.reduce((s, i) => s + i.late, 0), icon: <AlertTriangle className="w-4 h-4" />, color: 'amber' as const },
  ], [localData]);

  const handleDelete = (id: string) => {
    setLocalData(prev => prev.filter(i => i.id !== id));
    ps.closeConfirmDelete();
    success('Attendance record deleted');
  };

  const columns: Column<AttendanceSummary>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'month', label: 'Month', sortable: true, render: (i) => {
      const [y, m] = i.month.split('-');
      const d = new Date(+y, +m - 1);
      return <span className="text-sm text-ink-600">{d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>;
    } },
    { key: 'present', label: 'Present', sortable: true, render: (i) => <span className="font-medium text-emerald-600">{i.present}</span>, className: 'text-center' },
    { key: 'absent', label: 'Absent', sortable: true, render: (i) => <span className="font-medium text-rose-600">{i.absent}</span>, className: 'text-center' },
    { key: 'late', label: 'Late', sortable: true, render: (i) => <span className="font-medium text-amber-600">{i.late}</span>, className: 'text-center' },
    { key: 'total', label: 'Total', sortable: true, className: 'text-center' },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const selectedItem = ps.viewingId ? filtered.find(i => i.id === ps.viewingId) : null;
  const editItem = ps.editingId ? filtered.find(i => i.id === ps.editingId) : null;

  const csvHeaders = ['Employee', 'Month', 'Present', 'Absent', 'Late', 'Total'];
  const csvRows = filtered.map(i => [i.employeeName, i.month, String(i.present), String(i.absent), String(i.late), String(i.total)]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Attendance" description="Daily and monthly attendance reports with present, absent, and late counts"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'attendance'); success('CSV exported'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Attendance', pdfHeaders, pdfRows, 'attendance')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Record</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees..."
        statusFilter={''} onStatusChange={() => {}}
        onExportPdf={() => exportToPdf('Attendance', pdfHeaders, pdfRows, 'attendance')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No attendance records found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Attendance Record' : 'New Attendance Record'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Month</label><input type="month" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.month ?? ''} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Present</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.present ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Absent</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.absent ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Late</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.late ?? ''} /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editingId ? 'Record updated' : 'Record created'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Attendance Record" message="Are you sure you want to delete this attendance record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Attendance Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Month</label><p className="text-sm text-ink-700">{selectedItem.month}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">Present</label><p className="text-sm font-medium text-emerald-600">{selectedItem.present}</p></div>
            <div><label className="text-xs text-ink-500">Absent</label><p className="text-sm font-medium text-rose-600">{selectedItem.absent}</p></div>
            <div><label className="text-xs text-ink-500">Late</label><p className="text-sm font-medium text-amber-600">{selectedItem.late}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Total Days</label><p className="text-sm font-medium text-ink-900">{selectedItem.total}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}


