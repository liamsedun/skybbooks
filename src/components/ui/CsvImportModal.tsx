import React, { useState, useRef } from 'react';
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { CSV_TEMPLATES, downloadCsv, parseCsv } from '../../lib/csvTemplates';
import { api } from '../../lib/api';

interface Props {
  entity: string;
  endpoint: string;
  onClose: () => void;
  onSuccess: (ids?: string[]) => void;
  transformRow: (row: string[], headers: string[]) => any;
}

export function CsvImportModal({ entity, endpoint, onClose, onSuccess, transformRow }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  const template = CSV_TEMPLATES[entity];
  const label = entity.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    setResults(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setError('Please select a CSV file.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = parseCsv(ev.target?.result as string);
        if (data.rows.length > 500) { setError('Maximum 500 rows per import.'); return; }
        setPreview(data);
      } catch (err: any) {
        setError(err.message || 'Failed to parse CSV.');
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setError('');
    setResults(null);
    const errors: string[] = [];
    const importedIds: string[] = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < preview.rows.length; i++) {
      try {
        const payload = transformRow(preview.rows[i], preview.headers);
        const res = await api.post(endpoint, payload);
        if (res.data?.id) importedIds.push(res.data.id);
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`Row ${i + 2}: ${err?.response?.data?.message || err?.response?.data?.error || err.message || 'Unknown error'}`);
      }
    }

    setResults({ success, failed, errors });
    setImporting(false);
    if (failed === 0) {
      setTimeout(() => { (onSuccess as any)(importedIds); onClose(); }, 1500);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Import {label}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {results ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 text-sm font-medium ${results.failed > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {results.failed > 0 ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                {results.success} imported, {results.failed} failed
              </div>
              {results.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700 space-y-1">
                  {results.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{preview.rows.length} rows found. Review and import.</p>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {preview.headers.slice(0, 6).map(h => <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 capitalize">{h.replace(/_/g, ' ')}</th>)}
                      {preview.headers.length > 6 && <th className="px-3 py-2 text-left font-medium text-slate-500">...</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {row.slice(0, 6).map((cell, j) => <td key={j} className="px-3 py-2 text-slate-600 max-w-[160px] truncate">{cell}</td>)}
                        {row.length > 6 && <td className="px-3 py-2 text-slate-400">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 10 && <p className="text-xs text-slate-400">Showing first 10 of {preview.rows.length} rows</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => { setPreview(null); if (fileInput.current) fileInput.current.value = ''; }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button onClick={handleImport} disabled={importing}
                  className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {importing && <Loader2 size={14} className="animate-spin" />}
                  Import {preview.rows.length} {preview.rows.length === 1 ? 'row' : 'rows'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                <FileSpreadsheet size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600 mb-1">Upload a CSV file to import {label.toLowerCase()}</p>
                <p className="text-xs text-slate-400 mb-4">Maximum 500 rows</p>
                <button onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors">
                  <Upload size={15} /> Select CSV File
                </button>
                <input ref={fileInput} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button onClick={() => downloadCsv(template.filename, template.headers, template.sample)}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover font-medium">
                  <Download size={14} /> Download Template
                </button>
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
