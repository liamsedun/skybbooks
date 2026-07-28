import { useState } from 'react';
import { History, Download, FileText, Eye, Search } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, formatDate } from '../../../lib/hrExport';
import { hrApi } from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

interface DocVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  fileUrl: string;
  fileType: string | null;
  fileSize: number;
  changeNotes: string | null;
  uploadedBy: string;
  createdAt: string;
}

function fmtFileSize(bytes: number) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function DocVersionsPage() {
  const { success: showSuccess } = useToast();
  const [fileId, setFileId] = useState('');
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!fileId.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await hrApi.getDocVersions(fileId.trim());
      setVersions(Array.isArray(res) ? res : res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const openView = (id: string) => { setViewingId(id); setViewDrawerOpen(true); };
  const closeView = () => { setViewDrawerOpen(false); setViewingId(null); };

  const columns: Column<DocVersion>[] = [
    { key: 'versionNumber', label: 'Version #', sortable: true, render: (i) => <span className="font-medium text-ink-900">v{i.versionNumber}</span> },
    { key: 'fileUrl', label: 'File URL', render: (i) => <span className="text-ink-500 truncate max-w-[180px] block font-mono text-[11px]">{i.fileUrl}</span> },
    { key: 'fileType', label: 'File Type', render: (i) => <span className="text-ink-600 uppercase text-[11px] font-semibold">{i.fileType || '-'}</span> },
    { key: 'fileSize', label: 'File Size', render: (i) => <span className="text-ink-600">{fmtFileSize(i.fileSize)}</span> },
    { key: 'changeNotes', label: 'Change Notes', render: (i) => <span className="text-ink-500 truncate max-w-[160px] block">{i.changeNotes || '-'}</span> },
    { key: 'createdAt', label: 'Created At', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.createdAt)}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openView(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Document Versions" description="View version history for a document file"
      pageKey="doc-versions"
      headerActions={
        versions.length > 0 ? (
          <button onClick={() => { exportToCsv(['Version #', 'File URL', 'File Type', 'File Size', 'Change Notes', 'Created At'], versions.map(v => [String(v.versionNumber), v.fileUrl, v.fileType || '', fmtFileSize(v.fileSize), v.changeNotes || '', formatDate(v.createdAt)]), 'doc-versions'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
        ) : <></>
      }>
      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-4 sm:p-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Doc File ID</label>
            <input value={fileId} onChange={e => setFileId(e.target.value)}
              placeholder="Enter document file ID..."
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }} />
          </div>
          <button onClick={handleSearch} disabled={loading || !fileId.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </div>
      </div>
      <HrDataTable columns={columns} data={versions} keyExtractor={i => i.id} loading={loading}
        emptyMessage={searched ? 'No versions found for this document' : 'Enter a document file ID and click Search'}
        emptyIcon={<History className="w-8 h-8 text-ink-300" />} />
      <HrViewDrawer open={viewDrawerOpen} onClose={closeView} title="Version Details">
        {viewingId && (() => { const v = versions.find(i => i.id === viewingId); if (!v) return null; return (
          <div className="space-y-4 text-sm text-ink-600">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center"><History className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold text-ink-900">Version {v.versionNumber}</p><p className="text-xs text-ink-400">{v.fileType || '-'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-ink-400 text-xs">File Size</p><p className="font-medium">{fmtFileSize(v.fileSize)}</p></div>
              <div><p className="text-ink-400 text-xs">Created At</p><p className="font-medium">{formatDate(v.createdAt)}</p></div>
            </div>
            <div><p className="text-ink-400 text-xs">Change Notes</p><p className="font-medium text-ink-900 mt-1">{v.changeNotes || '-'}</p></div>
            <div><p className="text-ink-400 text-xs">File URL</p><p className="font-mono text-[11px] text-ink-700 mt-1 break-all">{v.fileUrl}</p></div>
            <div className="pt-2">
              <a href={v.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:text-primary-hover">
                <Download className="w-3.5 h-3.5" /> Download This Version
              </a>
            </div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}
