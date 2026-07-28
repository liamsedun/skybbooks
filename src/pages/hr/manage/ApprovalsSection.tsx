import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, ListChecks, CheckCircle, MessageSquare, Save, Check, X, Send } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { statusColor } from '../../../lib/hrExport';

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

function DetailsContent() {
  const { success } = useToast();
  const [name, setName] = useState('Leave Approval');
  const [desc, setDesc] = useState('Standard leave request approval process');
  const [reqManager, setReqManager] = useState(true);
  const [reqHr, setReqHr] = useState(false);
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Approval Details</h2><button onClick={() => success('Approval details saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Approval Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Leave Approval" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Describe the approval process" /></div>
        <div className="flex items-center gap-3"><input type="checkbox" checked={reqManager} onChange={e => setReqManager(e.target.checked)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /><span className="text-sm text-ink-600">Require manager approval</span></div>
        <div className="flex items-center gap-3"><input type="checkbox" checked={reqHr} onChange={e => setReqHr(e.target.checked)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /><span className="text-sm text-ink-600">Require HR approval</span></div>
      </div>
    </div>
  );
}

function CriteriaContent() {
  const { success } = useToast();
  const [minAmt, setMinAmt] = useState('0');
  const [maxAmt, setMaxAmt] = useState('1000000');
  const [level, setLevel] = useState('Single Level');
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Approval Criteria</h2><button onClick={() => success('Criteria saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Minimum Amount (₦)</label><input type="number" value={minAmt} onChange={e => setMinAmt(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="0" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Maximum Amount (₦)</label><input type="number" value={maxAmt} onChange={e => setMaxAmt(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="1000000" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Approval Level</label><select value={level} onChange={e => setLevel(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Single Level</option><option>Multi Level</option></select></div>
      </div>
    </div>
  );
}

function ListContent({ approvals, setApprovals }: { approvals: ApprovalItem[]; setApprovals: React.Dispatch<React.SetStateAction<ApprovalItem[]>> }) {
  const { success } = useToast();
  const handleAction = (id: string, status: ApprovalStatus) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    success(status === 'approved' ? 'Request approved' : 'Request rejected');
  };
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Approvals</h2></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">ID</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Requester</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{approvals.map(a => (
        <tr key={a.id} className="hover:bg-ink-50 transition-colors">
          <td className="px-3 py-2.5 text-sm font-medium text-ink-900">{a.id}</td>
          <td className="px-3 py-2.5 text-sm text-ink-600">{a.type}</td>
          <td className="px-3 py-2.5 text-sm text-ink-600">{a.requester}</td>
          <td className="px-3 py-2.5 text-sm text-ink-500">{a.date}</td>
          <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(a.status)}`}>{a.status}</span></td>
          <td className="px-3 py-2.5 text-right space-x-1">{a.status === 'pending' && (<><button onClick={() => handleAction(a.id, 'approved')} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"><Check className="w-3 h-3" /> Approve</button><button onClick={() => handleAction(a.id, 'rejected')} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"><X className="w-3 h-3" /> Reject</button></>)}</td>
        </tr>
      ))}</tbody></table></div>
    </div>
  );
}

function MessagesContent() {
  const { success } = useToast();
  const [messages, setMessages] = useState<MessageItem[]>([
    { from: 'Alice Johnson', text: 'Please approve my leave request for next week.', time: '2 hours ago' },
    { from: 'Bob Smith', text: 'Travel expense report has been submitted for review.', time: '5 hours ago' },
  ]);
  const [newMsg, setNewMsg] = useState('');
  const sendMessage = () => {
    if (!newMsg.trim()) return;
    setMessages(prev => [...prev, { from: 'You', text: newMsg.trim(), time: 'Just now' }]);
    setNewMsg('');
    success('Message sent');
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
  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    { id: 'A001', type: 'Leave Request', requester: 'Alice Johnson', date: '2026-07-25', status: 'pending' },
    { id: 'A002', type: 'Travel Request', requester: 'Bob Smith', date: '2026-07-24', status: 'approved' },
    { id: 'A003', type: 'Expense Report', requester: 'Carol White', date: '2026-07-23', status: 'pending' },
    { id: 'A004', type: 'Compensatory Off', requester: 'David Brown', date: '2026-07-22', status: 'rejected' },
    { id: 'A005', type: 'Leave Request', requester: 'Eve Davis', date: '2026-07-21', status: 'approved' },
  ]);

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
        {activeTab === 'details' && <DetailsContent />}
        {activeTab === 'criteria' && <CriteriaContent />}
        {activeTab === 'list' && <ListContent approvals={approvals} setApprovals={setApprovals} />}
        {activeTab === 'messages' && <MessagesContent />}
      </div>
    </div>
  );
}
