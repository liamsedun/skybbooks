import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, ListChecks, CheckCircle, MessageSquare, Save, Check, X, Send, Edit3, Trash2, Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { statusColor } from '../../../lib/hrExport';
import { orgApi } from '../../../lib/api';

const TABS = [
  { label: 'Approval Details', key: 'details', icon: FileText },
  { label: 'Criteria', key: 'criteria', icon: ListChecks },
  { label: 'Approvals List', key: 'list', icon: CheckCircle },
  { label: 'Messages', key: 'messages', icon: MessageSquare },
];

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ApprovalItem {
  id: string;
  type: string;
  requester: string;
  date: string;
  status: ApprovalStatus;
}

interface MessageItem {
  from: string;
  text: string;
  time: string;
}

function DetailsContent({ name, setName, desc, setDesc, reqManager, setReqManager, reqHr, setReqHr, onSave }: {
  name: string; setName: (v: string) => void; desc: string; setDesc: (v: string) => void;
  reqManager: boolean; setReqManager: (v: boolean) => void; reqHr: boolean; setReqHr: (v: boolean) => void; onSave: () => void;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Approval Details</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Approval Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Leave Approval" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Describe the approval process" /></div>
        <div className="flex items-center gap-3"><input type="checkbox" checked={reqManager} onChange={e => setReqManager(e.target.checked)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /><span className="text-sm text-ink-600">Require manager approval</span></div>
        <div className="flex items-center gap-3"><input type="checkbox" checked={reqHr} onChange={e => setReqHr(e.target.checked)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /><span className="text-sm text-ink-600">Require HR approval</span></div>
      </div>
    </div>
  );
}

function CriteriaContent({ minAmt, setMinAmt, maxAmt, setMaxAmt, level, setLevel, onSave }: {
  minAmt: string; setMinAmt: (v: string) => void; maxAmt: string; setMaxAmt: (v: string) => void;
  level: string; setLevel: (v: string) => void; onSave: () => void;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Approval Criteria</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Minimum Amount (₦)</label><input type="number" value={minAmt} onChange={e => setMinAmt(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="0" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Maximum Amount (₦)</label><input type="number" value={maxAmt} onChange={e => setMaxAmt(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="1000000" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Approval Level</label><select value={level} onChange={e => setLevel(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Single Level</option><option>Multi Level</option></select></div>
      </div>
    </div>
  );
}

function ListContent({ approvals, onAdd, onEdit, onDelete, onApprove, onReject }: { approvals: ApprovalItem[]; onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Approvals</h2><button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Approval</button></div>
      {approvals.length === 0 ? <p className="text-sm text-ink-400 p-3">No approvals yet.</p> : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">ID</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Requester</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{approvals.map(a => (
        <tr key={a.id} className="hover:bg-ink-50 transition-colors">
          <td className="px-3 py-2.5 text-sm font-medium text-ink-900">{a.id}</td>
          <td className="px-3 py-2.5 text-sm text-ink-600">{a.type}</td>
          <td className="px-3 py-2.5 text-sm text-ink-600">{a.requester}</td>
          <td className="px-3 py-2.5 text-sm text-ink-500">{a.date}</td>
          <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(a.status)}`}>{a.status}</span></td>
          <td className="px-3 py-2.5 text-right space-x-1">
            {a.status === 'pending' && (<><button onClick={() => onApprove(a.id)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"><Check className="w-3 h-3" /> Approve</button><button onClick={() => onReject(a.id)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"><X className="w-3 h-3" /> Reject</button></>)}
            <button onClick={() => onEdit(a.id)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"><Edit3 className="w-3 h-3" /> Edit</button>
            <button onClick={() => onDelete(a.id)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 className="w-3 h-3" /> Delete</button>
          </td>
        </tr>
      ))}</tbody></table></div>}
    </div>
  );
}

function MessagesContent({ messages, onSend }: { messages: MessageItem[]; onSend: (text: string) => void }) {
  const [newMsg, setNewMsg] = useState('');
  const sendMessage = () => {
    if (!newMsg.trim()) return;
    onSend(newMsg.trim());
    setNewMsg('');
  };
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Approval Messages</h2></div>
      <div className="space-y-3">{messages.map((m, i) => (
        <div key={i} className="flex items-start gap-3 p-3 border border-border-custom rounded-xl">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{m.from.charAt(0)}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-ink-900">{m.from}</p><p className="text-xs text-ink-500 mt-0.5">{m.text}</p><p className="text-[11px] text-ink-400 mt-1">{m.time}</p></div>
        </div>
      ))}</div>
      <div className="flex gap-2"><input value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} className="flex-1 px-3 py-2 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Type a message..." /><button onClick={sendMessage} className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Send</button></div>
    </div>
  );
}

export function ApprovalsSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'details';
  const { toast } = useToast();

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('Leave Approval');
  const [desc, setDesc] = useState('Standard leave request approval process');
  const [reqManager, setReqManager] = useState(true);
  const [reqHr, setReqHr] = useState(false);
  const [minAmt, setMinAmt] = useState('0');
  const [maxAmt, setMaxAmt] = useState('1000000');
  const [level, setLevel] = useState('Single Level');
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState('');
  const [formRequester, setFormRequester] = useState('');

  useEffect(() => {
    orgApi.getSettings().then(settings => {
      const ap = (settings as any)?.approvals || {};
      if (ap.name) setName(ap.name);
      if (ap.desc) setDesc(ap.desc);
      if (ap.reqManager !== undefined) setReqManager(ap.reqManager);
      if (ap.reqHr !== undefined) setReqHr(ap.reqHr);
      if (ap.minAmt) setMinAmt(ap.minAmt);
      if (ap.maxAmt) setMaxAmt(ap.maxAmt);
      if (ap.level) setLevel(ap.level);
      if (ap.messages) setMessages(ap.messages);
      if (ap.list) setApprovals(ap.list);
      setLoaded(true);
    }).catch(() => {
      const defaults: ApprovalItem[] = [
        { id: 'A001', type: 'Leave Request', requester: 'Alice Johnson', date: '2026-07-25', status: 'pending' },
        { id: 'A002', type: 'Travel Request', requester: 'Bob Smith', date: '2026-07-24', status: 'approved' },
        { id: 'A003', type: 'Expense Report', requester: 'Carol White', date: '2026-07-23', status: 'pending' },
        { id: 'A004', type: 'Compensatory Off', requester: 'David Brown', date: '2026-07-22', status: 'rejected' },
        { id: 'A005', type: 'Leave Request', requester: 'Eve Davis', date: '2026-07-21', status: 'approved' },
      ];
      setApprovals(defaults);
      setMessages([
        { from: 'Alice Johnson', text: 'Please approve my leave request for next week.', time: '2 hours ago' },
        { from: 'Bob Smith', text: 'Travel expense report has been submitted for review.', time: '5 hours ago' },
      ]);
      setLoaded(true);
    });
  }, []);

  const persistApprovals = async (list: ApprovalItem[]) => {
    const settings = (await orgApi.getSettings()) as any;
    await orgApi.updateSettings({ approvals: { ...(settings?.approvals || {}), list } });
    setApprovals(list);
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormType('Leave Request');
    setFormRequester('');
    setFormOpen(true);
  };

  const handleEdit = (id: string) => {
    const item = approvals.find(a => a.id === id);
    if (!item) return;
    setEditingId(id);
    setFormType(item.type);
    setFormRequester(item.requester);
    setFormOpen(true);
  };

  const handleSaveForm = async () => {
    if (!formType.trim() || !formRequester.trim()) { toast('Fill all fields', 'error'); return; }
    const date = new Date().toISOString().split('T')[0];
    if (editingId) {
      const updated = approvals.map(a => a.id === editingId ? { ...a, type: formType.trim(), requester: formRequester.trim() } : a);
      await persistApprovals(updated);
      toast('Approval updated', 'success');
    } else {
      const nextNum = String(approvals.length + 1).padStart(3, '0');
      const newItem: ApprovalItem = { id: `A${nextNum}`, type: formType.trim(), requester: formRequester.trim(), date, status: 'pending' };
      await persistApprovals([...approvals, newItem]);
      toast('Approval added', 'success');
    }
    setFormOpen(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const updated = approvals.filter(a => a.id !== id);
    await persistApprovals(updated);
    toast('Approval deleted', 'success');
  };

  const saveDetails = async () => {
    try {
      const settings = (await orgApi.getSettings()) as any;
      await orgApi.updateSettings({ approvals: { ...(settings?.approvals || {}), name, desc, reqManager, reqHr } });
      toast('Approval details saved', 'success');
    } catch { toast('Failed to save', 'error'); }
  };

  const saveCriteria = async () => {
    try {
      const settings = (await orgApi.getSettings()) as any;
      await orgApi.updateSettings({ approvals: { ...(settings?.approvals || {}), minAmt, maxAmt, level } });
      toast('Criteria saved', 'success');
    } catch { toast('Failed to save', 'error'); }
  };

  const handleApprove = async (id: string) => {
    const updated = approvals.map(a => a.id === id ? { ...a, status: 'approved' as const } : a);
    await persistApprovals(updated);
    toast('Request approved', 'success');
  };

  const handleReject = async (id: string) => {
    const updated = approvals.map(a => a.id === id ? { ...a, status: 'rejected' as const } : a);
    await persistApprovals(updated);
    toast('Request rejected', 'success');
  };

  const handleSendMessage = async (text: string) => {
    const newMsg: MessageItem = { from: 'You', text, time: 'Just now' };
    setMessages(prev => [...prev, newMsg]);
    try {
      const settings = (await orgApi.getSettings()) as any;
      const existing = settings?.approvals?.messages || [];
      await orgApi.updateSettings({ approvals: { ...(settings?.approvals || {}), messages: [...existing, newMsg] } });
      toast('Message sent', 'success');
    } catch { toast('Failed to save message', 'error'); }
  };

  if (!loaded) return <div className="p-6 text-sm text-ink-400">Loading...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setSearchParams({ tab: tab.key })}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                isActive ? 'bg-primary/10 text-primary' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="lg:col-span-3 space-y-6">
        {activeTab === 'details' && <DetailsContent name={name} setName={setName} desc={desc} setDesc={setDesc} reqManager={reqManager} setReqManager={setReqManager} reqHr={reqHr} setReqHr={setReqHr} onSave={saveDetails} />}
        {activeTab === 'criteria' && <CriteriaContent minAmt={minAmt} setMinAmt={setMinAmt} maxAmt={maxAmt} setMaxAmt={setMaxAmt} level={level} setLevel={setLevel} onSave={saveCriteria} />}
        {activeTab === 'list' && <ListContent approvals={approvals} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} onApprove={handleApprove} onReject={handleReject} />}
        {activeTab === 'messages' && <MessagesContent messages={messages} onSend={handleSendMessage} />}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setFormOpen(false); setEditingId(null); }}>
          <div className="bg-surface rounded-2xl border border-border-custom shadow-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink-900">{editingId ? 'Edit Approval' : 'Add Approval'}</h2>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select value={formType} onChange={e => setFormType(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900"><option>Leave Request</option><option>Travel Request</option><option>Expense Report</option><option>Compensatory Off</option></select></div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Requester</label><input value={formRequester} onChange={e => setFormRequester(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" placeholder="Requester name" /></div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={() => { setFormOpen(false); setEditingId(null); }} className="px-4 py-2 text-sm font-medium text-ink-600 bg-ink-100 rounded-xl hover:bg-ink-200">Cancel</button><button onClick={handleSaveForm} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-hover"><Save className="w-3.5 h-3.5 inline mr-1" />{editingId ? 'Update' : 'Add'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
