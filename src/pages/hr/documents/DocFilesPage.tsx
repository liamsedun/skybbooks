import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Download, FileEdit, Edit3, Trash2, Eye, Upload, History, Shield } from 'lucide-react';

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

interface DocFile {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number;
  fileHash: string | null;
  version: number;
  status: string;
  expiryDate: string | null;
  accessLevel: string;
  tags: string[];
  uploadedBy: string;
  createdAt: string;
}

interface DocVersion {
  id: string;
  version: number;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}

interface FormData {
  name: string;
  categoryId: string;
  description: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  fileSize: string;
  status: string;
  expiryDate: string;
  accessLevel: string;
  tags: string;
}

const emptyForm: FormData = {
  name: '',
  categoryId: '',
  description: '',
  fileUrl: '',
  fileType: '',
  mimeType: '',
  fileSize: '0',
  status: 'draft',
  expiryDate: '',
  accessLevel: 'public',
  tags: '',
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + units[i];
}

export function DocFilesPage() {
  const { toast } = useToast();

  const [docFiles, setDocFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DocFile | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<DocFile | null>(null);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  const fetchDocFiles = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.categoryId = categoryFilter;
      const res = await hrApi.getDocFiles(params);
      setDocFiles(res.data ?? []);
    } catch {
      toast('Failed to load document files', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocFiles();
  }, [search, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = docFiles.length;
    const active = docFiles.filter((d) => d.status === 'active').length;
    const archived = docFiles.filter((d) => d.status === 'archived').length;
    const expired = docFiles.filter((d) => d.status === 'expired').length;
    return [
      { label: 'Total', value: total, icon: FileText, color: 'blue' as const },
      { label: 'Active', value: active, icon: Shield, color: 'green' as const },
      { label: 'Archived', value: archived, icon: FileEdit, color: 'amber' as const },
      { label: 'Expired', value: expired, icon: History, color: 'red' as const },
    ];
  }, [docFiles]);

  const columns: Column<DocFile>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => <span className="font-medium text-ink-900">{row.name}</span>,
    },
    {
      key: 'fileType',
      label: 'Type',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
          <FileText className="h-3 w-3" />
          {row.fileType}
        </span>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      sortable: true,
      render: (row) => <span className="text-ink-600">{row.version}</span>,
    },
    {
      key: 'fileSize',
      label: 'File Size',
      render: (row) => <span className="text-ink-600">{formatFileSize(row.fileSize)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(row.status)}`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'accessLevel',
      label: 'Access Level',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
          <Shield className="h-3 w-3" />
          {row.accessLevel}
        </span>
      ),
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date',
      render: (row) => <span className="text-ink-600">{row.expiryDate ? formatDate(row.expiryDate) : '—'}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setViewItem(row)}
            className="rounded p-1 text-ink-400 hover:text-primary hover:bg-primary/10"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleEdit(row)}
            className="rounded p-1 text-ink-400 hover:text-amber-600 hover:bg-amber-50"
            title="Edit"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="rounded p-1 text-ink-400 hover:text-rose-600 hover:bg-rose-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleVersions(row.id)}
            className="rounded p-1 text-ink-400 hover:text-primary hover:bg-primary/10"
            title="Versions"
          >
            <History className="h-4 w-4" />
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  const handleEdit = (item: DocFile) => {
    setEditing(item);
    setFormData({
      name: item.name,
      categoryId: item.categoryId ?? '',
      description: item.description ?? '',
      fileUrl: item.fileUrl,
      fileType: item.fileType,
      mimeType: item.mimeType ?? '',
      fileSize: String(item.fileSize),
      status: item.status,
      expiryDate: item.expiryDate ?? '',
      accessLevel: item.accessLevel,
      tags: (item.tags ?? []).join(', '),
    });
    setShowForm(true);
  };

  const handleVersions = async (id: string) => {
    try {
      const res = await hrApi.getDocVersions(id);
      setVersions(res.data ?? []);
      setShowVersions(true);
    } catch {
      toast('Failed to load versions', 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.fileUrl.trim()) {
      toast('Name and File URL are required', 'error');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId.trim() || null,
        description: formData.description.trim() || null,
        fileUrl: formData.fileUrl.trim(),
        fileType: formData.fileType.trim(),
        mimeType: formData.mimeType.trim() || null,
        fileSize: parseInt(formData.fileSize, 10) || 0,
        status: formData.status,
        expiryDate: formData.expiryDate || null,
        accessLevel: formData.accessLevel,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (editing) {
        await hrApi.updateDocFile(editing.id, payload);
        toast('Document file updated', 'success');
      } else {
        await hrApi.createDocFile(payload);
        toast('Document file created', 'success');
      }
      setShowForm(false);
      setEditing(null);
      setFormData(emptyForm);
      fetchDocFiles();
    } catch {
      toast('Failed to save document file', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await hrApi.deleteDocFile(deleteId);
      toast('Document file deleted', 'success');
      setDeleteId(null);
      fetchDocFiles();
    } catch {
      toast('Failed to delete document file', 'error');
    }
  };

  const filters = (
    <HrFilterBar>
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="expired">Expired</option>
      </select>
      <select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">All Categories</option>
        {[...new Set(docFiles.map((d) => d.categoryId).filter(Boolean))].map((cid) => (
          <option key={cid} value={cid!}>
            {cid}
          </option>
        ))}
      </select>
    </HrFilterBar>
  );

  const formFields = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Category ID</label>
        <input
          type="text"
          value={formData.categoryId}
          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">File URL *</label>
        <input
          type="text"
          value={formData.fileUrl}
          onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">File Type</label>
        <input
          type="text"
          value={formData.fileType}
          onChange={(e) => setFormData({ ...formData, fileType: e.target.value })}
          placeholder="pdf, docx, xlsx..."
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">MIME Type</label>
        <input
          type="text"
          value={formData.mimeType}
          onChange={(e) => setFormData({ ...formData, mimeType: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">File Size (bytes)</label>
        <input
          type="number"
          min="0"
          value={formData.fileSize}
          onChange={(e) => setFormData({ ...formData, fileSize: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Access Level</label>
        <select
          value={formData.accessLevel}
          onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="public">Public</option>
          <option value="restricted">Restricted</option>
          <option value="confidential">Confidential</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
        <input
          type="date"
          value={formData.expiryDate}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="policy, handbook, 2025"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );

  return (
    <HrPageShell
      title="Document Files"
      description="Manage document files with version control"
      actions={
        <button
          onClick={() => {
            setEditing(null);
            setFormData(emptyForm);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Document
        </button>
      }
    >
      <HrStatCards items={stats} />
      {filters}

      <HrDataTable
        columns={columns}
        data={docFiles}
        loading={loading}
        keyExtractor={(row) => row.id}
        emptyMessage="No document files found"
        emptyAction={<button onClick={() => { setEditing(null); setFormData(emptyForm); setShowForm(true); }} className="text-xs font-medium text-primary">Add your first document</button>}
      />

      <HrFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
          setFormData(emptyForm);
        }}
        title={editing ? 'Edit Document File' : 'Add Document File'}
        onSave={handleSave}
        saving={saving}
      >
        {formFields}
      </HrFormModal>

      <HrConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Document File"
        message="Are you sure you want to delete this document file? This action cannot be undone."
      />

      <HrViewDrawer
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        title={viewItem?.name ?? ''}
      >
        {viewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Name</label>
                <p className="text-sm text-gray-900">{viewItem.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Category ID</label>
                <p className="text-sm text-gray-900">{viewItem.categoryId ?? '—'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">File URL</label>
                <a
                  href={viewItem.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Download className="h-3 w-3" />
                  Open
                </a>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">File Type</label>
                <p className="text-sm text-gray-900">{viewItem.fileType}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">MIME Type</label>
                <p className="text-sm text-gray-900">{viewItem.mimeType ?? '—'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">File Size</label>
                <p className="text-sm text-gray-900">{formatFileSize(viewItem.fileSize)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Version</label>
                <p className="text-sm text-gray-900">{viewItem.version}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Status</label>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(viewItem.status)}`}
                >
                  {viewItem.status}
                </span>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Access Level</label>
                <p className="text-sm text-gray-900">{viewItem.accessLevel}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Expiry Date</label>
                <p className="text-sm text-gray-900">
                  {viewItem.expiryDate ? formatDate(viewItem.expiryDate) : '—'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Uploaded By</label>
                <p className="text-sm text-gray-900">{viewItem.uploadedBy}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Created At</label>
                <p className="text-sm text-gray-900">{formatDate(viewItem.createdAt)}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Description</label>
              <p className="text-sm text-gray-900">{viewItem.description ?? '—'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Tags</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {viewItem.tags && viewItem.tags.length > 0
                  ? viewItem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                      >
                        {tag}
                      </span>
                    ))
                  : <span className="text-sm text-gray-500">—</span>}
              </div>
            </div>
          </div>
        )}
      </HrViewDrawer>

      <HrViewDrawer
        open={showVersions}
        onClose={() => {
          setShowVersions(false);
          setVersions([]);
        }}
        title="Version History"
      >
        <div className="space-y-3">
          {versions.length === 0 ? (
            <p className="text-sm text-gray-500">No versions found.</p>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">v{v.version}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(v.fileSize)} &middot; {formatDate(v.createdAt)}
                  </p>
                  <p className="text-xs text-gray-400">by {v.uploadedBy}</p>
                </div>
                <a
                  href={v.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            ))
          )}
        </div>
      </HrViewDrawer>
    </HrPageShell>
  );
}
