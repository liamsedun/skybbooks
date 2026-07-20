import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Bot, User, MessageSquare, Cpu, Tag, FileText, CheckCircle, X, AlertCircle, Zap } from 'lucide-react';
import { nvidiaApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

type Tab = 'assistant' | 'categorise' | 'ocr';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'assistant', label: 'AI Assistant', icon: MessageSquare },
  { key: 'categorise', label: 'Categorize', icon: Tag },
  { key: 'ocr', label: 'OCR Extract', icon: FileText },
];

// ── Message types for chat ──
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  'How is my business performing?',
  'Explain my trial balance',
  'What does my cash flow look like?',
  'Detect any suspicious transactions',
  'Generate a management report',
  'Suggest a journal entry for depreciation',
  'Summarize this month',
  'What are my IFRS reporting impacts?',
];

export function NvidiaAiPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('assistant');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-sm">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">NVIDIA Nemotron AI</h1>
          <p className="text-xs text-slate-500">Powered by Nemotron-3 Ultra 550B</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === t.key ? 'bg-purple-50 text-purple-700' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'assistant' && <AssistantTab />}
      {activeTab === 'categorise' && <CategoriseTab />}
      {activeTab === 'ocr' && <OcrTab />}
    </div>
  );
}

// ── Assistant Tab ──
function AssistantTab() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: 'Hello! I\'m your NVIDIA-powered AI Accounting Assistant. I can analyze your financial data, explain reports, detect anomalies, and more. Try a suggestion below or ask anything.', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await nvidiaApi.assistantQuery(content);
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res?.data?.response || 'No response generated.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: `Error: ${err.response?.data?.error || err.message}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(`[^`]+`)/g);
    return React.createElement('div', { className: 'whitespace-pre-wrap text-sm leading-relaxed' },
      ...parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return React.createElement('code', { key: i, className: 'bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono' }, part.slice(1, -1));
        }
        return part;
      })
    );
  };

  return (
    <div className="flex flex-col bg-white rounded-xl border border-slate-200 min-h-[600px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-h-[500px]">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md'
                : 'bg-slate-50 border border-slate-200 text-slate-700'
            }`}>
              {renderContent(msg.content)}
              <p className="text-[9px] text-slate-400 mt-1.5">{msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-200 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-slate-500" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-sm flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing your financial data with Nemotron...
              </div>
            </div>
          </div>
        )}
        {messages.length === 1 && !loading && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-400 mb-3 text-center">Try asking:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => sendMessage(p)}
                  className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all shadow-sm">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask about your financial data..."
              rows={1}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
            />
          </div>
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-40 shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Categorise Tab ──
function CategoriseTab() {
  const [description, setDescription] = useState('');
  const [amountKobo, setAmountKobo] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ desc: string; amount: number; result: any }>>([]);

  const handleCategorise = async () => {
    if (!description.trim() || !amountKobo) return;
    setLoading(true);
    try {
      const res = await nvidiaApi.categorise(description, amountKobo);
      const data = res?.data;
      setResult(data);
      setHistory(prev => [{ desc: description, amount: amountKobo, result: data }, ...prev].slice(0, 20));
    } catch (err: any) {
      setResult({ accountCode: '', accountName: 'Error', confidence: 0, reasoning: err.message });
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (c: number) => {
    if (c >= 80) return 'text-emerald-600 bg-emerald-50';
    if (c >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Input */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Categorise Transaction</h2>
        <p className="text-xs text-slate-500 mb-5">Describe a transaction and Nemotron will suggest the best account category.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" rows={3}
              placeholder="e.g., Purchased office furniture and supplies for the Lagos HQ" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Amount (kobo) *</label>
            <input type="number" min={0} value={amountKobo} onChange={e => setAmountKobo(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="2500000" />
            {amountKobo > 0 && <p className="text-xs text-slate-400 mt-1">{fmtNaira(amountKobo)}</p>}
          </div>
          <button onClick={handleCategorise} disabled={loading || !description || !amountKobo}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Analysing...' : 'Categorise'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-purple-700">Classification Result</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColor(result.confidence)}`}>
                {result.confidence}% confident
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Account</span><span className="font-medium text-slate-900">{result.accountName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Code</span><code className="text-xs font-mono bg-purple-100 px-1.5 py-0.5 rounded">{result.accountCode || '—'}</code></div>
              <div className="pt-2 border-t border-purple-100">
                <p className="text-xs text-slate-500">{result.reasoning}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Recent Classifications</h2>
        {history.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Tag className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No classifications yet. Try categorising a transaction.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Description</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Amount</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Category</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Confidence</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[200px] truncate">{h.desc}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-600">{fmtNaira(h.amount)}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        {h.result?.accountName || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${confidenceColor(h.result?.confidence || 0)}`}>
                        {h.result?.confidence || 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── OCR Tab ──
function OcrTab() {
  const [rawText, setRawText] = useState('');
  const [mimeType, setMimeType] = useState('text/plain');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [result]);

  const handleExtract = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    try {
      const res = await nvidiaApi.ocrExtract(rawText, mimeType);
      setResult(res?.data);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Paste OCR Text</h2>
        <p className="text-xs text-slate-500 mb-5">Paste raw OCR text from a receipt, invoice, or bill document for AI extraction.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Document Type</label>
            <select value={mimeType} onChange={e => setMimeType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
              <option value="text/plain">Receipt / Invoice</option>
              <option value="application/pdf">PDF (text extracted)</option>
              <option value="image/jpeg">Image (JPEG/PNG text)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Raw OCR Text *</label>
            <textarea value={rawText} onChange={e => setRawText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-xs" rows={12}
              placeholder={`Paste OCR text here...

Example:
INVOICE
ABC Store Ltd
123 Main Street
Date: 15/06/2026
Item 1: Office Chair x 2 @ ₦45,000 = ₦90,000
Item 2: Desk Lamp x 1 @ ₦12,500 = ₦12,500
Subtotal: ₦102,500
VAT (7.5%): ₦7,687.50
Total: ₦110,187.50`} />
          </div>
          <button onClick={handleExtract} disabled={loading || !rawText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Extracting...' : 'Extract Data'}
          </button>
        </div>
      </div>

      {/* Result */}
      <div ref={resultRef} className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Extracted Data</h2>
        <p className="text-xs text-slate-500 mb-5">Structured data parsed by Nemotron-3.</p>

        {!result ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Paste OCR text and click Extract to see results.</p>
          </div>
        ) : result.error ? (
          <div className="flex items-center gap-2 p-4 bg-red-50 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {result.error}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Confidence */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                result.confidence >= 80 ? 'bg-emerald-50 text-emerald-700' : result.confidence >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              }`}>
                <CheckCircle className="w-3 h-3" />
                {result.confidence}% confidence
              </span>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-0.5">Vendor</p>
                <p className="font-medium text-slate-900">{result.vendorName || '—'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-0.5">Date</p>
                <p className="font-medium text-slate-900">{result.date || '—'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-0.5">Document Number</p>
                <p className="font-medium text-slate-900">{result.documentNumber || '—'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-0.5">Currency</p>
                <p className="font-medium text-slate-900">{result.currency || 'NGN'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-0.5">Total</p>
                <p className="font-medium text-slate-900">{result.totalAmountKobo ? fmtNaira(result.totalAmountKobo) : '—'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-0.5">VAT</p>
                <p className="font-medium text-slate-900">{result.vatAmountKobo != null ? fmtNaira(result.vatAmountKobo) : '—'}</p>
              </div>
            </div>

            {/* Line Items */}
            {result.lineItems?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Line Items</p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-slate-500">Description</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-500">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-500">Unit Price</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.lineItems.map((li: any, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-slate-700">{li.description}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{li.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmtNaira(li.unitPriceKobo)}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">{fmtNaira(li.totalKobo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Document type badge */}
            <div className="flex items-center gap-2">
              {result.isBill ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                  <FileText className="w-3 h-3" /> Bill / Purchase
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                  <FileText className="w-3 h-3" /> Invoice / Receipt
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
