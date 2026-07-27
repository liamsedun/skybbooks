import { useState, useRef, useCallback } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { handleFileUpload, parseCsv, downloadSampleCsv } from '../../lib/hrExport';
import { useToast } from '../../contexts/ToastContext';

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: string[][]) => void;
  columns: { key: string; label: string; required?: boolean }[];
  sampleFilename?: string;
  loading?: boolean;
  error?: string | null;
  title?: string;
}

export function ImportCsvModal({ open, onClose, onImport, columns, sampleFilename = 'sample-import', loading, error, title = 'Import CSV' }: ImportCsvModalProps) {
  const { toast } = useToast();
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState<string[][]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const text = await handleFileUpload(e);
      setRaw(text);
      const rows = parseCsv(text);
      if (rows.length < 2) {
        toast('CSV must have a header row and at least one data row', 'error');
        return;
      }
      setParsed(rows);
      setStep('preview');
    } catch {
      toast('Failed to read file', 'error');
    }
  }, [toast]);

  const handleImport = () => {
    if (parsed.length < 2) return;
    onImport(parsed);
  };

  const reset = () => {
    setRaw('');
    setParsed([]);
    setStep('upload');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  const headerRow = parsed[0] || [];
  const dataRows = parsed.slice(1);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border-custom" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-custom shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><FileSpreadsheet className="w-4 h-4" /></div>
            <div><h2 className="text-base font-semibold text-ink-900">{title}</h2><p className="text-[10px] text-ink-400">{step === 'upload' ? 'Upload a CSV file' : `Preview ${dataRows.length} rows`}</p></div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-600"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

          {step === 'upload' && (
            <div className="space-y-4">
              <div className="bg-ink-50 dark:bg-ink-800/50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-medium text-ink-700">Required columns:</p>
                <ul className="space-y-1">
                  {columns.map(col => (
                    <li key={col.key} className="flex items-center gap-2 text-ink-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${col.required ? 'bg-rose-400' : 'bg-ink-300'}`} />
                      {col.label} {col.required && <span className="text-rose-500 text-[10px]">(required)</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <label className="flex flex-col items-center justify-center w-full py-8 px-4 border-2 border-dashed border-border-custom rounded-xl cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5">
                <Upload className="w-8 h-8 text-ink-300 mb-2" />
                <p className="text-sm font-medium text-ink-600">Click to upload CSV</p>
                <p className="text-[10px] text-ink-400 mt-0.5">.csv files only</p>
                <input type="file" accept=".csv" onChange={handleFile} className="sr-only" />
              </label>

              <div className="text-center">
                <button type="button" onClick={() => downloadSampleCsv(columns.map(c => c.label), sampleFilename)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors">
                  <Download className="w-3.5 h-3.5" />Download sample CSV
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {dataRows.length} rows parsed successfully
              </div>

              <div className="border border-border-custom rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-ink-50 dark:bg-ink-800/50">
                      {headerRow.map((h, i) => <th key={i} className="px-3 py-2 text-left font-medium text-ink-500 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 10).map((row, ri) => (
                      <tr key={ri} className="border-t border-border-custom hover:bg-ink-50/50 dark:hover:bg-ink-800/30">
                        {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-ink-700 max-w-[200px] truncate">{cell}</td>)}
                      </tr>
                    ))}
                    {dataRows.length > 10 && (
                      <tr className="border-t border-border-custom">
                        <td colSpan={headerRow.length} className="px-3 py-2 text-center text-ink-400 italic">
                          ...and {dataRows.length - 10} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border-custom shrink-0">
          <button type="button" onClick={() => step === 'preview' ? setStep('upload') : handleClose()}
            className="text-xs font-medium text-ink-500 hover:text-ink-700 transition-colors">
            {step === 'preview' ? 'Back to upload' : 'Cancel'}
          </button>
          {step === 'preview' && (
            <button onClick={handleImport} disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Importing...' : `Import ${dataRows.length} rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ExportColumn {
  key: string;
  label: string;
  selected?: boolean;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'pdf', columns: string[]) => void;
  columns: ExportColumn[];
  loading?: boolean;
  title?: string;
}

export function ExportModal({ open, onClose, onExport, columns, loading, title = 'Export' }: ExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    columns.forEach(c => { init[c.key] = c.selected !== false; });
    return init;
  });

  const toggleColumn = (key: string) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => setSelected(prev => {
    const next: Record<string, boolean> = {};
    Object.keys(prev).forEach(k => { next[k] = true; });
    return next;
  });

  const deselectAll = () => setSelected(prev => {
    const next: Record<string, boolean> = {};
    Object.keys(prev).forEach(k => { next[k] = false; });
    return next;
  });

  const handleExport = () => {
    const chosen = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (chosen.length === 0) return;
    onExport(format, chosen);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg border border-border-custom p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Download className="w-4 h-4" /></div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-600 mb-2">Format</label>
          <div className="flex gap-2">
            {(['csv', 'pdf'] as const).map(f => (
              <button key={f} type="button" onClick={() => setFormat(f)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${format === f ? 'border-primary bg-primary/5 text-primary' : 'border-border-custom text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800/50'}`}>
                {f === 'csv' ? <FileSpreadsheet className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                {f === 'csv' ? 'CSV' : 'PDF'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-ink-600">Columns ({selectedCount} selected)</label>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-[10px] font-medium text-primary hover:text-primary-hover transition-colors">Select all</button>
              <button type="button" onClick={deselectAll} className="text-[10px] font-medium text-ink-400 hover:text-ink-600 transition-colors">Clear</button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border border-border-custom rounded-xl divide-y divide-border-custom">
            {columns.map(col => (
              <label key={col.key} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/30 transition-colors">
                <input type="checkbox" checked={!!selected[col.key]} onChange={() => toggleColumn(col.key)}
                  className="w-3.5 h-3.5 rounded border-ink-300 text-primary focus:ring-primary/30" />
                <span className="text-sm text-ink-700">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">Cancel</button>
          <button onClick={handleExport} disabled={loading || selectedCount === 0}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Exporting...' : `Export ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
