import { useState } from 'react';
import { Users, Download, FileText, Eye, Search } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, formatDate } from '../../../lib/hrExport';
import { hrApi } from '../../../lib/api';

interface EmployeeDoc {
  id: string;
  name: string;
  fileType: string;
  version: number;
  status: string;
  expiryDate: string | null;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number;
  description: string | null;
  categoryId: string | null;
  accessLevel: string;
  tags: string[] | null;
  uploadedBy: string;
  createdAt: string;
  linkType: string;
}

function fmtFileSize(bytes: number) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function DocEmployeeDocsPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!employeeId.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await hrApi.getEmployeeDocs(employeeId.trim());
      setDocs(Array.isArray(res) ? res : res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const openView = (id: string) => { setViewingId(id); setViewDrawerOpen(true); };
  const closeView = () => { setViewDrawerOpen(false); setViewingId(null); };

  const columns: Column<EmployeeDoc>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'fileType', label: 'Type', render: (i) => <span className="text-ink-600 uppercase text-[11px] font-semibold">{i.fileType}</span> },
    { key: 'version', label: 'Version', render: (i) => <span className="text-ink-600">v{i.version}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : i.status === 'expired' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-ink-100 text-ink-500 border-ink-200'}`}>{i.status}</span> },
    { key: 'expiryDate', label: 'Expiry Date', render: (i) => <span className="text-ink-500">{i.expiryDate ? formatDate(i.expiryDate) : '-'}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openView(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Employee Documents" description="View documents linked to a specific employee"
      pageKey="doc-employee-docs"
      headerActions={
        docs.length > 0 ? (
          <>
            <button onClick={() => { exportToCsv(['Name', 'Type', 'Version', 'Status', 'Expiry Date', 'File Size'], docs.map(d => [d.name, d.fileType, String(d.version), d.status, d.expiryDate || '', fmtFileSize(d.fileSize)]), 'employee-docs'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
            <button onClick={() => exportToPdf('Employee Documents', ['Name', 'Type', 'Version', 'Status', 'Expiry Date'], docs.map(d => [d.name, d.fileType, String(d.version), d.status, d.expiryDate || '']), 'employee-docs')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          </>
        ) : <></>
      }>
      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-4 sm:p-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label>
            <input value={employeeId} onChange={e => setEmployeeId(e.target.value)}
              placeholder="Enter employee ID..."
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
          </div>
          <button onClick={handleSearch} disabled={loading || !employeeId.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </div>
      </div>
      <HrDataTable columns={columns} data={docs} keyExtractor={i => i.id} loading={loading}
        emptyMessage={searched ? 'No documents found for this employee' : 'Enter an employee ID and click Search'}
        emptyIcon={<Users className="w-8 h-8 text-ink-300" />} />
      <HrViewDrawer open={viewDrawerOpen} onClose={closeView} title="Document Details">
        {viewingId && (() => { const d = docs.find(i => i.id === viewingId); if (!d) return null; return (
          <div className="space-y-4 text-sm text-ink-600">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold text-ink-900">{d.name}</p><p className="text-xs text-ink-400">v{d.version} · {d.fileType}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-ink-400 text-xs">Status</p><p className="font-medium capitalize">{d.status}</p></div>
              <div><p className="text-ink-400 text-xs">File Size</p><p className="font-medium">{fmtFileSize(d.fileSize)}</p></div>
              <div><p className="text-ink-400 text-xs">MIME Type</p><p className="font-medium">{d.mimeType || '-'}</p></div>
              <div><p className="text-ink-400 text-xs">Link Type</p><p className="font-medium capitalize">{d.linkType}</p></div>
              <div><p className="text-ink-400 text-xs">Expiry Date</p><p className="font-medium">{d.expiryDate ? formatDate(d.expiryDate) : '-'}</p></div>
              <div><p className="text-ink-400 text-xs">Access Level</p><p className="font-medium capitalize">{d.accessLevel}</p></div>
            </div>
            <div><p className="text-ink-400 text-xs">Description</p><p className="font-medium text-ink-900 mt-1">{d.description || '-'}</p></div>
            {d.tags && d.tags.length > 0 && (
              <div><p className="text-ink-400 text-xs">Tags</p><div className="flex flex-wrap gap-1 mt-1">{d.tags.map((t, i) => <span key={i} className="px-2 py-0.5 bg-ink-50 dark:bg-ink-800 rounded-lg text-[11px] font-medium text-ink-600">{t}</span>)}</div></div>
            )}
            <div className="pt-2">
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:text-primary-hover">
                <Download className="w-3.5 h-3.5" /> Download File
              </a>
            </div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}
