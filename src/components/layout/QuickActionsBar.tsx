/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  FileText,
  FileCode,
  Users,
  Building2,
  Receipt,
  BookOpen,
  ArrowRightLeft,
  UserCheck,
  Clock,
  UserPlus,
} from 'lucide-react';

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  state?: Record<string, unknown>;
}

const actions: QuickAction[] = [
  { label: 'New Invoice', icon: FileText, path: '/app/sales/invoices/new' },
  { label: 'New Bill', icon: FileCode, path: '/app/purchases/bills/new' },
  { label: 'New Customer', icon: Users, path: '/app/sales/customers', state: { openAddModal: true } },
  { label: 'New Vendor', icon: Building2, path: '/app/purchases/vendors' },
  { label: 'Record Expense', icon: Receipt, path: '/app/purchases/expenses/new' },
  { label: 'Manual Journal', icon: BookOpen, path: '/app/accountant/journals/new' },
  { label: 'Bank Transfer', icon: ArrowRightLeft, path: '/app/banking/transfers' },
  { label: 'Approve Leave', icon: UserCheck, path: '/app/hr/approvals' },
  { label: 'Clock In', icon: Clock, path: '/app/hr/attendance' },
  { label: 'Add Employee', icon: UserPlus, path: '/app/hr/employees/new' },
];

export function QuickActionsBar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (action: QuickAction) => {
    navigate(action.path, { state: action.state });
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="mb-3 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3"
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.path}
                  onClick={() => handleAction(action)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors w-full text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-12 h-12 rounded-full bg-primary text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all cursor-pointer"
        title="Quick Actions"
      >
        <Zap className="w-5 h-5" />
      </button>
    </div>
  );
}

export default QuickActionsBar;
