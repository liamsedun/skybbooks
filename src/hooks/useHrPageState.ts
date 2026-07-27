import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface HrPageStateConfig<T> {
  data: T[];
  initialSortKey?: keyof T;
  initialSortDirection?: SortDirection;
  searchKeys?: (keyof T)[];
  pageSize?: number;
}

export function useHrPageState<T extends Record<string, any>>({
  data,
  initialSortKey,
  initialSortDirection = 'asc',
  searchKeys,
  pageSize = 10,
}: HrPageStateConfig<T>) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDirection>(initialSortDirection);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    let result = [...data];
    if (search && searchKeys) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        searchKeys.some(key => String(item[key] ?? '').toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, searchKeys, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const handleSort = useCallback((key: keyof T) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const openAddModal = useCallback(() => {
    setEditingId(null);
    setFormError(null);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((id: string) => {
    setEditingId(id);
    setFormError(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  }, []);

  const openViewDrawer = useCallback((id: string) => {
    setViewingId(id);
    setViewDrawerOpen(true);
  }, []);

  const closeViewDrawer = useCallback(() => {
    setViewDrawerOpen(false);
    setViewingId(null);
  }, []);

  const openConfirmDelete = useCallback((id: string) => {
    setDeletingId(id);
    setConfirmOpen(true);
  }, []);

  const closeConfirmDelete = useCallback(() => {
    setConfirmOpen(false);
    setDeletingId(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === paginated.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginated.map(item => String(item.id)));
    }
  }, [paginated, selectedIds]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const hasActiveFilters = search || statusFilter !== 'all' || dateFrom || dateTo;

  return {
    search, setSearch,
    statusFilter, setStatusFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    sortKey, sortDir,
    page, setPage: (p: number) => setPage(Math.max(1, Math.min(p, totalPages))),
    totalPages: totalPages,
    pageSize,
    selectedIds, setSelectedIds,
    filtered,
    paginated,
    handleSort,
    openAddModal, openEditModal, closeModal,
    modalOpen, editingId, formError, setFormError,
    submitting, setSubmitting,
    viewDrawerOpen, viewingId, openViewDrawer, closeViewDrawer,
    confirmOpen, deletingId, openConfirmDelete, closeConfirmDelete,
    importOpen, setImportOpen,
    exporting, setExporting,
    handleSelectAll, handleSelectOne,
    clearFilters, hasActiveFilters,
  };
}
