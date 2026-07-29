import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FileText, FileSpreadsheet, FileImage, Plus, Download, Upload, Edit3, Trash2, Eye } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface FileItem {
  id: string;
  name: string;
  category: 'document' | 'template' | 'report';
  uploadedBy: string;
  size: string;
  uploadDate: string;
  status: 'active' | 'archived';
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-rose-500" />;
  if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  if (ext === 'docx' || ext === 'doc') return <FileText className="w-4 h-4 text-blue-500" />;
  if (ext === 'pptx' || ext === 'ppt') return <FileImage className="w-4 h-4 text-orange-500" />;
  return <FileText className="w-4 h-4 text-ink-400" />;
}

export function FilesPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'uploadedBy', 'category'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getDocFiles({}); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <FolderOpen className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Documents', value: data.filter(i => i.category === 'document').length, icon: <FileText className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'document', onClick: () => ps.setStatusFilter('document') },
    { label: 'Templates', value: data.filter(i => i.category === 'template').length, icon: <FileSpreadsheet className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'template', onClick: () => ps.setStatusFilter('template') },
    { label: 'Reports', value: data.filter(i => i.category === 'report').length, icon: <FileImage className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'report', onClick: () => ps.setStatusFilter('report') },
  ], [data, ps.statusFilter]);

  const columns: Column<FileItem>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => (
      <span className="inline-flex items-center gap-2 font-medium text-ink-900">
        <FileTypeIcon name={i.name} />
        <span className="truncate max-w-[200px]">{i.name}</span>
      </span>
    )},
    { key: 'category', label: 'Category', sortable: true, render: (i) => <span className="text-ink-600 capitalize">{i.category}</span> },
    { key: 'uploadedBy', label: 'Uploaded By', render: (i) => <span className="text-ink-600">{i.uploadedBy}</span> },
    { key: 'size', label: 'Size', render: (i) => <span className="text-ink-600">{i.size}</span> },
    { key: 'uploadDate', label: 'Date', sortable: true, render: (i) => <span className="text-ink-600">{formatDate(i.uploadDate)}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Files" description="Organisation and employee document storage, file uploads, and records management"
      pageKey="letters"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name', 'Category', 'Uploaded By', 'Size', 'Date', 'Status'], ps.filtered.map(i => [i.name, i.category, i.uploadedBy, i.size, i.uploadDate, i.status]), 'hr-files'); showSuccess('CSV exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('HR Files', ['Name', 'Category', 'Uploaded By', 'Size', 'Date', 'Status'], ps.filtered.map(i => [i.name, i.category, i.uploadedBy, i.size, i.uploadDate, i.status]), 'hr-files')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => ps.setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Upload</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add File</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name, uploader, or category..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Document', value: 'document' }, { label: 'Template', value: 'template' }, { label: 'Report', value: 'report' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {ps.selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-ink-600">{ps.selectedIds.length} selected</span>
          <button onClick={() => { showError('Read-only view'); ps.setSelectedIds([]); }} className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">Delete Selected</button>
        </div>
      )}
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No files found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Upload your first file</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit File' : 'Add File'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">File Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Category</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>document</option><option>template</option><option>report</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">File</label><input type="file" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete File" message="Are you sure you want to delete this file? This action cannot be undone." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="File Details">
        {ps.viewingId && (() => {
          const item = data.find(i => i.id === ps.viewingId);
          if (!item) return null;
          return (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <FileTypeIcon name={item.name} />
                <div><span className="font-medium text-ink-900">{item.name}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-ink-400 text-xs block">Category</span><span className="font-medium text-ink-900 capitalize">{item.category}</span></div>
                <div><span className="text-ink-400 text-xs block">Uploaded By</span><span className="font-medium text-ink-900">{item.uploadedBy}</span></div>
                <div><span className="text-ink-400 text-xs block">Size</span><span className="font-medium text-ink-900">{item.size}</span></div>
                <div><span className="text-ink-400 text-xs block">Upload Date</span><span className="font-medium text-ink-900">{formatDate(item.uploadDate)}</span></div>
                <div><span className="text-ink-400 text-xs block">Status</span><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span></div>
              </div>
            </div>
          );
        })()}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Upload File" onSubmit={(e) => { e.preventDefault(); showSuccess('File upload is a read-only view'); ps.setImportOpen(false); }} submitLabel="Upload">
        <p className="text-sm text-ink-400 mb-3">Select a file to upload to the HR document store.</p>
        <input type="file" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" />
      </HrFormModal>
    </HrPageShell>
  );
}


