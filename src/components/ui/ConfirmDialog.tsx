/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  id?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  id,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id || 'confirmation-modal-wrapper'} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay drop backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-100 z-10 p-6"
          >
            {/* Header X icon */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:bg-slate-50 transition-colors outline-none"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content body layout */}
            <div className="flex items-start space-x-4 mb-6">
              <div className={`p-2.5 rounded-xl ${isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-purple-50 text-purple-600'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-800 leading-6">{title}</h3>
                <p className="text-sm text-slate-505 text-slate-500 mt-1.5 leading-relaxed">{message}</p>
              </div>
            </div>

            {/* Actions footer buttons */}
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 outline-none rounded-xl hover:bg-slate-50 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm();
                  onClose();
                }}
                className={`px-4 py-2 text-sm font-semibold text-white outline-none rounded-xl shadow-xs hover:shadow transition-all ${
                  isDestructive 
                    ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' 
                    : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
export default ConfirmDialog;
