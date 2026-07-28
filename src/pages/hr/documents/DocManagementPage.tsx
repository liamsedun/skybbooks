import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, Upload, Download, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { hrApi } from '../../../lib/api';

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

interface DocDashboardStats {
  totalFiles: number;
  activeFiles: number;
  expiredFiles: number;
  totalCategories: number;
  totalSize: number;
}

const quickLinks = [
  { label: 'All Files', path: '/app/hr/documents/files', icon: FileText, description: 'Browse and manage all uploaded documents' },
  { label: 'Categories', path: '/app/hr/documents/categories', icon: FolderOpen, description: 'Organize documents by category' },
  { label: 'Employee Docs', path: '/app/hr/documents/employee', icon: FileText, description: 'View documents by employee' },
  { label: 'Expired Docs', path: '/app/hr/documents/files?status=expired', icon: AlertTriangle, description: 'Review documents past their expiry date' },
  { label: 'Upload', path: '/app/hr/documents/upload', icon: Upload, description: 'Upload new documents' },
];

export function DocManagementPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DocDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getDocDashboard();
      setStats(res.data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Files', value: stats.totalFiles, icon: FileText, color: 'blue' as const },
      { label: 'Active', value: stats.activeFiles, icon: FileText, color: 'green' as const },
      { label: 'Expired', value: stats.expiredFiles, icon: AlertTriangle, color: 'red' as const },
      { label: 'Categories', value: stats.totalCategories, icon: FolderOpen, color: 'purple' as const },
      { label: 'Total Size', value: fmtSize(stats.totalSize), icon: Download, color: 'indigo' as const },
    ];
  }, [stats]);

  return (
    <HrPageShell
      title="Document Management"
      subtitle="Manage employee documents, categories, and file storage"
      actions={
        <button
          onClick={loadStats}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      }
    >
      <HrStatCards cards={statCards} loading={loading} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
            >
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900">{link.label}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors ml-auto" />
                </div>
                <p className="text-sm text-gray-500 mt-1">{link.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </HrPageShell>
  );
}
