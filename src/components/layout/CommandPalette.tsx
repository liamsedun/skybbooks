/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  LayoutDashboard,
  FileText,
  FileCode,
  PlusCircle,
  Users,
  Building2,
  CreditCard,
  BookOpen,
  BarChart3,
  Lock,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  category: string;
  action: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handler = () => toggle();
    window.addEventListener('command-palette:toggle', handler);
    return () => window.removeEventListener('command-palette:toggle', handler);
  }, [toggle]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
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
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const commands: Command[] = useMemo(() => [
    { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, category: 'Navigation', action: () => navigate('/app/dashboard') },
    { id: 'customers', label: 'Go to Customers', icon: Users, category: 'Navigation', action: () => navigate('/app/sales/customers') },
    { id: 'invoices', label: 'Go to Invoices', icon: FileText, category: 'Navigation', action: () => navigate('/app/sales/invoices') },
    { id: 'bills', label: 'Go to Bills', icon: FileText, category: 'Navigation', action: () => navigate('/app/purchases/bills') },
    { id: 'chart-of-accounts', label: 'Go to Chart of Accounts', icon: BookOpen, category: 'Navigation', action: () => navigate('/app/accountant/chart-of-accounts') },
    { id: 'journals', label: 'Go to Manual Journals', icon: FileCode, category: 'Navigation', action: () => navigate('/app/accountant/journals') },
    { id: 'reports', label: 'Go to Reports', icon: BarChart3, category: 'Navigation', action: () => navigate('/app/reports/trial-balance') },
    { id: 'vendors', label: 'Go to Vendors', icon: Building2, category: 'Navigation', action: () => navigate('/app/purchases/vendors') },
    { id: 'bank-accounts', label: 'Go to Bank Accounts', icon: CreditCard, category: 'Navigation', action: () => navigate('/app/banking') },
    { id: 'new-invoice', label: 'New Invoice', icon: PlusCircle, shortcut: 'Cmd+I', category: 'Actions', action: () => navigate('/app/sales/invoices/new') },
    { id: 'new-bill', label: 'New Bill', icon: PlusCircle, shortcut: 'Cmd+B', category: 'Actions', action: () => navigate('/app/purchases/bills/new') },
    { id: 'new-customer', label: 'New Customer', icon: Users, category: 'Actions', action: () => navigate('/app/sales/customers?new=1') },
    { id: 'new-vendor', label: 'New Vendor', icon: Building2, category: 'Actions', action: () => navigate('/app/purchases/vendors?new=1') },
    { id: 'record-payment', label: 'Record Payment', icon: CreditCard, category: 'Actions', action: () => navigate('/app/sales/payments') },
    { id: 'lock-screen', label: 'Lock Screen', icon: Lock, category: 'Quick', action: () => {} },
  ], [navigate]);

  const filteredGroups = useMemo(() => {
    const q = query.toLowerCase().trim();
    const groups: { category: string; items: Command[] }[] = [];
    const map = new Map<string, Command[]>();

    commands.forEach((cmd) => {
      if (!q || cmd.label.toLowerCase().includes(q)) {
        if (!map.has(cmd.category)) map.set(cmd.category, []);
        map.get(cmd.category)!.push(cmd);
      }
    });

    map.forEach((items, category) => {
      groups.push({ category, items });
    });

    return groups;
  }, [commands, query]);

  const flatList = useMemo(() => {
    return filteredGroups.flatMap((g) => g.items);
  }, [filteredGroups]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      e.preventDefault();
      flatList[selectedIndex].action();
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [flatList, selectedIndex]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

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
                placeholder="Search commands..."
                className="w-full ml-3 text-lg bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-0"
              />
            </div>

            <div className="max-h-80 overflow-y-auto py-2">
              {filteredGroups.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  No results found for "{query}"
                </div>
              )}

              {filteredGroups.map((group) => (
                <div key={group.category}>
                  <div className="px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {group.category}
                  </div>
                  {group.items.map((cmd) => {
                    const idx = flatList.indexOf(cmd);
                    const isSelected = idx === selectedIndex;
                    const Icon = cmd.icon;

                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center px-5 py-2.5 text-left transition-colors ${
                          isSelected
                            ? 'bg-primary-light dark:bg-primary/20 text-primary'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className={`p-1 rounded-lg ${
                          isSelected ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="ml-3 text-sm font-medium flex-1">{cmd.label}</span>
                        {cmd.shortcut && (
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {cmd.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
export default CommandPalette;
