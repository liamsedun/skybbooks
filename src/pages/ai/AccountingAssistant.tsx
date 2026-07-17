import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, Send, Loader2, Bot, User, RefreshCw, MessageSquare,
  BarChart3, TrendingUp, Scale, Shield, Copy, FileText, BookOpen,
  Calendar, Lightbulb, Library, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { assistantApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

const CAPABILITY_ICONS: Record<string, React.ReactNode> = {
  'explain-financials': React.createElement(BarChart3, { className: 'w-4 h-4' }),
  'explain-trial-balance': React.createElement(Scale, { className: 'w-4 h-4' }),
  'predict-cash-flow': React.createElement(TrendingUp, { className: 'w-4 h-4' }),
  'detect-fraud': React.createElement(Shield, { className: 'w-4 h-4' }),
  'detect-duplicates': React.createElement(Copy, { className: 'w-4 h-4' }),
  'generate-report': React.createElement(FileText, { className: 'w-4 h-4' }),
  'suggest-journal': React.createElement(BookOpen, { className: 'w-4 h-4' }),
  'explain-ifrs': React.createElement(Library, { className: 'w-4 h-4' }),
  'summarize-month': React.createElement(Calendar, { className: 'w-4 h-4' }),
  'executive-insights': React.createElement(Lightbulb, { className: 'w-4 h-4' }),
};

const SUGGESTED_PROMPTS = [
  'How is my business performing this year?',
  'Explain my trial balance differences',
  'What does my cash flow look like?',
  'Detect any suspicious transactions',
  'Generate a management report',
  'Suggest a journal entry for depreciation',
  'Summarize this month\'s performance',
  'What are my IFRS reporting impacts?',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  capability?: string;
  data?: any;
  timestamp: Date;
}

export function AccountingAssistant() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m your AI Accounting Assistant. I can help you understand your financial data, detect anomalies, generate reports, suggest journal entries, and much more. Try one of the suggestions below or ask me anything about your accounts.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const capabilitiesQuery = useQuery({
    queryKey: ['assistant-capabilities'],
    queryFn: () => assistantApi.getCapabilities(),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !!token,
  });

  const capabilities = capabilitiesQuery.data?.data || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await assistantApi.query(content);
      const data = result?.data;

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.response || 'I encountered an error processing your request.',
        capability: data?.capability,
        data: data?.data,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.response?.data?.error || err.message}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCapabilityClick = (cap: any) => {
    setSelectedCapability(cap.id);
    const msg = `Tell me about: ${cap.label}`;
    sendMessage(msg);
  };

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(`[^`]+`)/g);
    const elements: (string | React.ReactElement)[] = [];
    parts.forEach((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        elements.push(React.createElement('code', {
          key: i,
          className: 'bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono',
        }, part.slice(1, -1)));
      } else {
        elements.push(part);
      }
    });
    return React.createElement('div', { className: 'whitespace-pre-wrap' }, ...elements);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-0 max-w-7xl mx-auto">
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200 shrink-0">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">AI Assistant</h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ask anything about your accounts</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 px-2 mb-3">Capabilities</p>
          {capabilities.map((cap: any) => (
            <button
              key={cap.id}
              onClick={() => handleCapabilityClick(cap)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
                selectedCapability === cap.id
                  ? 'bg-blue-50 border border-blue-200 shadow-sm'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${
                  selectedCapability === cap.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500'
                }`}>
                  {CAPABILITY_ICONS[cap.id] || React.createElement(MessageSquare, { className: 'w-3.5 h-3.5' })}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${
                    selectedCapability === cap.id ? 'text-blue-700' : 'text-slate-700'
                  }`}>{cap.label}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{cap.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Connected to your data
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-50/50 to-white min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[85%] md:max-w-[75%] ${
                msg.role === 'user' ? 'order-1' : ''
              }`}>
                <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'
                    : 'bg-white border border-slate-200/80 shadow-sm text-slate-700'
                }`}>
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                    {renderContent(msg.content)}
                  </div>
                  {msg.capability && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                      <div className="text-[9px] text-slate-400 flex items-center gap-1">
                        {CAPABILITY_ICONS[msg.capability]}
                        <span>{msg.capability.replace(/-/g, ' ')}</span>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5 px-1">
                  {msg.role === 'assistant' ? 'AI Assistant' : 'You'} &middot; {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3.5 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing your financial data...
                </div>
              </div>
            </div>
          )}

          {/* Suggested prompts (only show at start) */}
          {messages.length === 1 && !loading && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold text-slate-400 mb-3 text-center">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3.5 py-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-200 bg-white px-4 md:px-8 py-4">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances, detect anomalies, suggest journal entries..."
                rows={1}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                style={{ minHeight: '44px', maxHeight: '120px' }}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {loading ? React.createElement(Loader2, { className: 'w-4 h-4 animate-spin' }) : React.createElement(Send, { className: 'w-4 h-4' })}
            </button>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-2 max-w-4xl mx-auto">
            AI responses are generated based on your live financial data. Verify critical information before acting on it.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AccountingAssistant;
