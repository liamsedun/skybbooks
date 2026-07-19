/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Loader2,
  FileText,
  Users,
  Building2,
  BookOpen,
  Receipt,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';

interface SearchResult {
  id: string | number;
  label: string;
  subtitle?: string;
  link: string;
}

interface SearchSection {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loading: boolean;
  results: SearchResult[];
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sections, setSections] = useState<Record<string, SearchSection>>({
    customers: { key: 'customers', icon: Users, label: 'Customers', loading: false, results: [] },
    vendors: { key: 'vendors', icon: Building2, label: 'Vendors', loading: false, results: [] },
    accounts: { key: 'accounts', icon: BookOpen, label: 'Accounts', loading: false, results: [] },
    invoices: { key: 'invoices', icon: FileText, label: 'Invoices', loading: false, results: [] },
    bills: { key: 'bills', icon: Receipt, label: 'Bills', loading: false, results: [] },
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setQuery('');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSections((prev) => {
        const reset = { ...prev };
        Object.keys(reset).forEach((k) => {
          reset[k] = { ...reset[k], results: [], loading: false };
        });
        return reset;
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setSections((prev) => {
        const reset = { ...prev };
        Object.keys(reset).forEach((k) => {
          reset[k] = { ...reset[k], results: [], loading: false };
        });
        return reset;
      });
      return;
    }

    debounceRef.current = setTimeout(() => {
      setSections((prev) => {
        const loading = { ...prev };
        Object.keys(loading).forEach((k) => {
          loading[k] = { ...loading[k], loading: true };
        });
        return loading;
      });

      const params = { search: q, limit: 5 };

      Promise.all([
        api.get('/sales/customers', { params }).then((r) => {
          const data = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.customers || [];
          return {
            key: 'customers' as const,
            results: data.map((c: any) => ({
              id: c.id,
              label: c.name || c.displayName || c.customerName || '',
              subtitle: c.email || c.phone || '',
              link: `/app/sales/customers/${c.id}`,
            })),
          };
        }).catch(() => ({ key: 'customers' as const, results: [] })),

        api.get('/purchases/vendors', { params }).then((r) => {
          const data = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.vendors || [];
          return {
            key: 'vendors' as const,
            results: data.map((v: any) => ({
              id: v.id,
              label: v.name || v.displayName || '',
              subtitle: v.email || v.phone || '',
              link: `/app/purchases/vendors/${v.id}`,
            })),
          };
        }).catch(() => ({ key: 'vendors' as const, results: [] })),

        api.get('/accountant/accounts', { params }).then((r) => {
          const data = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.accounts || [];
          return {
            key: 'accounts' as const,
            results: data.map((a: any) => ({
              id: a.id,
              label: `${a.code || ''} ${a.name || ''}`.trim(),
              subtitle: a.type || '',
              link: `/app/accountant/chart-of-accounts`,
            })),
          };
        }).catch(() => ({ key: 'accounts' as const, results: [] })),

        api.get('/sales/invoices', { params }).then((r) => {
          const data = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.invoices || [];
          return {
            key: 'invoices' as const,
            results: data.map((inv: any) => ({
              id: inv.id,
              label: inv.invoiceNumber || inv.number || `Invoice #${inv.id}`,
              subtitle: inv.customerName || inv.customer?.name || '',
              link: `/app/sales/invoices/${inv.id}`,
            })),
          };
        }).catch(() => ({ key: 'invoices' as const, results: [] })),

        api.get('/purchases/bills', { params }).then((r) => {
          const data = Array.isArray(r.data) ? r.data : r.data?.data || r.data?.bills || [];
          return {
            key: 'bills' as const,
            results: data.map((b: any) => ({
              id: b.id,
              label: b.billNumber || b.number || `Bill #${b.id}`,
              subtitle: b.vendorName || b.vendor?.name || '',
              link: `/app/purchases/bills/${b.id}`,
            })),
          };
        }).catch(() => ({ key: 'bills' as const, results: [] })),
      ]).then((results) => {
        setSections((prev) => {
          const updated = { ...prev };
          results.forEach((res) => {
            if (updated[res.key]) {
              updated[res.key] = { ...updated[res.key], loading: false, results: res.results };
            }
          });
          return updated;
        });
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const flatList = useMemo(() => {
    const list: { sectionKey: string; result: SearchResult }[] = [];
    Object.values(sections).forEach((section) => {
      section.results.forEach((result) => {
        list.push({ sectionKey: section.key, result });
      });
    });
    return list;
  }, [sections]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      e.preventDefault();
      navigate(flatList[selectedIndex].result.link);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [flatList, selectedIndex, navigate]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const hasNoResults = Object.values(sections).every((s) => !s.loading && s.results.length === 0) && query.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-10 overflow-hidden"
          >
            <div className="flex items-center px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search customers, invoices, accounts..."
                className="w-full ml-3 text-lg bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-0"
              />
              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto py-2">
              {Object.values(sections).map((section) => {
                const Icon = section.icon;

                if (section.loading) {
                  return (
                    <div key={section.key}>
                      <div className="px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {section.label}
                      </div>
                      <div className="px-5 py-3 flex items-center space-x-2 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching...</span>
                      </div>
                    </div>
                  );
                }

                if (section.results.length === 0) return null;

                return (
                  <div key={section.key}>
                    <div className="px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Icon className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      {section.label}
                    </div>
                    {section.results.map((result) => {
                      const idx = flatList.findIndex(
                        (f) => f.sectionKey === section.key && f.result.id === result.id
                      );
                      const isSelected = idx === selectedIndex;

                      return (
                        <button
                          key={`${section.key}-${result.id}`}
                          onClick={() => {
                            navigate(result.link);
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center px-5 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'bg-primary-light dark:bg-primary/20 text-primary'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="text-sm font-medium block truncate">{result.label}</span>
                            {result.subtitle && (
                              <span className="text-xs text-slate-400 truncate block">{result.subtitle}</span>
                            )}
                          </span>
                          <ArrowRight className={`w-4 h-4 shrink-0 ml-2 ${isSelected ? 'text-primary' : 'text-slate-300'}`} />
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {hasNoResults && (
                <div className="px-5 py-8 text-center">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No results found for "{query}"</p>
                  <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
export default GlobalSearch;
