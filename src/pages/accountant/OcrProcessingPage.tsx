import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, RefreshCw, Loader2, Eye, AlertCircle, Search, FileUp, Trash2, Download, ArrowRight, BookOpen, Clock, DollarSign } from 'lucide-react';
import { bankingApi } from '../../lib/api';
import { api } from '../../lib/api';

interface OcrDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
  docType: string | null;
  status: string;
  extractedData: any;
  suggestedJournal: any;
  journalEntryId: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const DOC_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  invoice: { label: 'Invoice', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  bill: { label: 'Bill', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  receipt: { label: 'Receipt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  purchase_order: { label: 'PO', className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-600' },
  extracting: { label: 'Extracting...', className: 'bg-yellow-50 text-yellow-700' },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-700' },
  posted: { label: 'Posted', className: 'bg-indigo-50 text-indigo-700' },
  error: { label: 'Error', className: 'bg-red-50 text-red-700' },
};

function fmtNaira(kobo: number) {
  if (!kobo) return '₦0.00';
  return `₦${(kobo / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function OcrProcessingPage() {
  const [documents, setDocuments] = useState<OcrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<OcrDocument | null>(null);
  const [editableJournal, setEditableJournal] = useState<any>(null);
  const [filter, setFilter] = useState({ status: 'ready', docType: '' });
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await api.get('/ocr/documents', { params: { status: filter.status || undefined, docType: filter.docType || undefined, limit: 50 } });
      setDocuments(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch OCR documents', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  useEffect(() => {
    if (documents.some(d => d.status === 'extracting' || d.status === 'pending')) {
      if (!pollInterval) {
        const interval = setInterval(fetchDocs, 3000);
        setPollInterval(interval);
      }
    } else {
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    }
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [documents, fetchDocs, pollInterval]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/ocr/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDocs();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleConfirm = async (doc: OcrDocument) => {
    if (!editableJournal) return;
    if (!confirm('Post this journal entry? This action cannot be undone.')) return;

    const journal = {
      description: editableJournal.description,
      date: editableJournal.date,
      lines: editableJournal.lines.map((l: any) => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: l.debit,
        credit: l.credit,
      })),
    };

    try {
      await api.post(`/ocr/documents/${doc.id}/confirm`, { suggestedJournal: journal });
      await fetchDocs();
      setSelectedDoc(null);
      setEditableJournal(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Failed to post journal');
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api.delete(`/ocr/documents/${docId}`);
      await fetchDocs();
      if (selectedDoc?.id === docId) setSelectedDoc(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Delete failed');
    }
  };

  const handleReprocess = async (docId: string) => {
    try {
      await api.post(`/ocr/documents/${docId}/reprocess`);
      await fetchDocs();
    } catch (err: any) {
      alert(err?.response?.data?.error || err.message || 'Reprocess failed');
    }
  };

  const selectDoc = (doc: OcrDocument) => {
    setSelectedDoc(doc);
    if (doc.suggestedJournal) {
      setEditableJournal(JSON.parse(JSON.stringify(doc.suggestedJournal)));
    } else {
      setEditableJournal(null);
    }
  };

  const updateJournalLine = (index: number, field: string, value: any) => {
    if (!editableJournal) return;
    const lines = [...editableJournal.lines];
    lines[index] = { ...lines[index], [field]: value };
    const totalDr = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
    const totalCr = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);
    setEditableJournal({ ...editableJournal, lines, totalDebits: totalDr, totalCredits: totalCr });
  };

  const sortedDocs = [...documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = sortedDocs.filter(d => {
    if (search && !d.fileName.toLowerCase().includes(search.toLowerCase()) && !d.docType?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: documents.length,
    extracting: documents.filter(d => d.status === 'extracting' || d.status === 'pending').length,
    ready: documents.filter(d => d.status === 'ready').length,
    posted: documents.filter(d => d.status === 'posted').length,
    error: documents.filter(d => d.status === 'error').length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">OCR Document Processing</h1>
          <p className="text-sm text-slate-500 mt-1">Upload invoices, bills, receipts & purchase orders for automatic data extraction</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', count: counts.all, className: 'bg-white text-slate-900 border-slate-200' },
          { label: 'Processing', count: counts.extracting, className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: 'Ready', count: counts.ready, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Posted', count: counts.posted, className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          { label: 'Errors', count: counts.error, className: 'bg-red-50 text-red-700 border-red-200' },
        ].map(({ label, count, className }) => (
          <div key={label} className={`rounded-xl border p-3 ${className}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
            <div className="text-lg font-bold mt-1">{count}</div>
          </div>
        ))}
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors cursor-pointer ${
          dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">Drop a PDF, JPEG, PNG or TIFF here, or click to browse</p>
        <p className="text-[11px] text-slate-400 mt-1">Invoices, Bills, Receipts & Purchase Orders supported (up to 20MB)</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <select
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="extracting">Extracting</option>
          <option value="ready">Ready</option>
          <option value="posted">Posted</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filter.docType}
          onChange={e => setFilter(f => ({ ...f, docType: e.target.value }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="invoice">Invoice</option>
          <option value="bill">Bill</option>
          <option value="receipt">Receipt</option>
          <option value="purchase_order">Purchase Order</option>
        </select>
        <button onClick={fetchDocs} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No OCR documents found</p>
              <p className="text-xs text-slate-400 mt-1">Upload a document to get started</p>
            </div>
          ) : (
            filtered.map(doc => {
              const dtBadge = DOC_TYPE_BADGES[doc.docType || ''] || { label: doc.docType || 'Unknown', className: 'bg-slate-100 text-slate-600' };
              const stBadge = STATUS_BADGES[doc.status] || { label: doc.status, className: 'bg-slate-100 text-slate-600' };
              return (
                <div
                  key={doc.id}
                  onClick={() => selectDoc(doc)}
                  className={`bg-white rounded-xl border p-3.5 flex items-center justify-between cursor-pointer transition-all hover:shadow-sm ${
                    selectedDoc?.id === doc.id ? 'border-indigo-300 ring-2 ring-indigo-500/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      doc.status === 'posted' ? 'bg-indigo-100 text-indigo-600' :
                      doc.status === 'error' ? 'bg-red-100 text-red-500' :
                      doc.status === 'ready' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {doc.status === 'extracting' || doc.status === 'pending' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       doc.status === 'posted' ? <CheckCircle className="w-4 h-4" /> :
                       doc.status === 'error' ? <AlertCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 truncate">{doc.fileName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${dtBadge.className}`}>{dtBadge.label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stBadge.className}`}>{stBadge.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>{new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        {doc.fileSize && <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                        {doc.extractedData?.totalAmount > 0 && <span>{fmtNaira(doc.extractedData.totalAmount)}</span>}
                      </div>
                      {doc.errorMessage && <div className="text-[11px] text-red-500 mt-0.5 truncate">{doc.errorMessage}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {doc.status === 'error' && (
                      <button onClick={e => { e.stopPropagation(); handleReprocess(doc.id); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors" title="Reprocess">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {doc.status === 'ready' && (
                      <button onClick={e => { e.stopPropagation(); selectDoc(doc); }}
                        className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors" title="Review & Post">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedDoc && editableJournal ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">Journal Preview</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${DOC_TYPE_BADGES[selectedDoc.docType || '']?.className || 'bg-slate-100 text-slate-600'}`}>
                  {selectedDoc.docType?.toUpperCase()}
                </span>
              </div>

              <div className="mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Description</label>
                <input
                  type="text"
                  value={editableJournal.description}
                  onChange={e => setEditableJournal({ ...editableJournal, description: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="mb-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Date</label>
                <input
                  type="date"
                  value={editableJournal.date?.split('T')[0] || new Date().toISOString().split('T')[0]}
                  onChange={e => setEditableJournal({ ...editableJournal, date: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                {editableJournal.lines.map((line: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <input
                        type="text"
                        value={line.accountCode}
                        onChange={e => updateJournalLine(idx, 'accountCode', e.target.value)}
                        className="w-20 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                        placeholder="Code"
                      />
                      <span className="text-[9px] text-slate-400 font-mono">{selectedDoc.extractedData?.lineItems?.[idx]?.description || ''}</span>
                    </div>
                    <input
                      type="text"
                      value={line.accountName}
                      onChange={e => updateJournalLine(idx, 'accountName', e.target.value)}
                      className="w-full mb-1.5 px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                      placeholder="Account name"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <span className="text-[8px] text-slate-400 font-bold uppercase">DR</span>
                        <input
                          type="number"
                          value={line.debit}
                          onChange={e => updateJournalLine(idx, 'debit', parseInt(e.target.value) || 0)}
                          className="w-full px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[8px] text-slate-400 font-bold uppercase">CR</span>
                        <input
                          type="number"
                          value={line.credit}
                          onChange={e => updateJournalLine(idx, 'credit', parseInt(e.target.value) || 0)}
                          className="w-full px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1 px-1">
                <span>Total DR: {fmtNaira(editableJournal.totalDebits)}</span>
                <span>Total CR: {fmtNaira(editableJournal.totalCredits)}</span>
              </div>
              {editableJournal.totalDebits !== editableJournal.totalCredits && (
                <div className="flex items-center gap-1 text-[10px] text-red-600 mb-3 px-1">
                  <AlertCircle className="w-3 h-3" />
                  Journal is not balanced (DR ≠ CR)
                </div>
              )}

              {selectedDoc.extractedData && (
                <div className="mb-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Extracted Data</h3>
                  <div className="space-y-0.5 text-[10px] text-slate-600">
                    {selectedDoc.extractedData.vendorName && <div>Vendor: {selectedDoc.extractedData.vendorName}</div>}
                    {selectedDoc.extractedData.customerName && <div>Customer: {selectedDoc.extractedData.customerName}</div>}
                    {selectedDoc.extractedData.documentNumber && <div>Doc #: {selectedDoc.extractedData.documentNumber}</div>}
                    {selectedDoc.extractedData.date && <div>Date: {selectedDoc.extractedData.date}</div>}
                    {selectedDoc.extractedData.totalAmount > 0 && <div className="font-bold">{fmtNaira(selectedDoc.extractedData.totalAmount)}</div>}
                    {selectedDoc.extractedData.lineItems?.length > 0 && (
                      <div className="mt-1">
                        <div className="font-semibold text-[9px] uppercase text-slate-400">Line Items:</div>
                        {selectedDoc.extractedData.lineItems.slice(0, 5).map((item: any, i: number) => (
                          <div key={i} className="truncate">{item.description || `Item ${i + 1}`}: {fmtNaira(item.amount)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirm(selectedDoc)}
                  disabled={editableJournal.totalDebits !== editableJournal.totalCredits}
                  className="flex-1 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Post Journal
                </button>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedDoc?.status === 'extracting' || selectedDoc?.status === 'pending' ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">Processing...</p>
              <p className="text-[11px] text-slate-400 mt-1">Extracting data with OCR & AI</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
