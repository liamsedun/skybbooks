import React, { useState, useEffect } from 'react';
import { Plus, Eye, Trash2, FileText, DollarSign, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { revenueApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
function fmtNaira(v: number): string {
  const abs = Math.abs(v);
  const naira = Math.floor(abs / 100);
  const kobo = abs % 100;
  const formatted = naira.toLocaleString('en-US') + '.' + String(kobo).padStart(2, '0');
  return (v < 0 ? '-₦' : '₦') + formatted;
}

interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  customerName?: string;
  customerCode?: string;
  description?: string;
  status: string;
  totalContractValue: number;
  startDate: string;
  endDate?: string;
  billingFrequency?: string;
  currency: string;
  notes?: string;
  performanceObligations?: any[];
}

export function RevenueContractsPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    setLoading(true);
    try {
      const data = await revenueApi.listContracts();
      setContracts(data);
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      if (formData.id) {
        await revenueApi.updateContract(formData.id, formData);
      } else {
        await revenueApi.createContract(formData);
      }
      setShowForm(false);
      setFormData({});
      loadContracts();
    } catch (err) {
      console.error('Failed to save contract:', err);
    }
  }

  function openContractDetail(contract: Contract) {
    revenueApi.getContract(contract.id).then(data => setSelectedContract(data));
  }

  async function deleteContract(id: string) {
    if (!confirm('Delete this contract and all related obligations?')) return;
    try {
      await revenueApi.deleteContract(id);
      loadContracts();
    } catch (err) {
      console.error('Failed to delete contract:', err);
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-neutral-100 text-neutral-600',
      active: 'bg-emerald-50 text-emerald-700',
      completed: 'bg-blue-50 text-blue-700',
      cancelled: 'bg-red-50 text-red-600',
      modified: 'bg-amber-50 text-amber-700',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || 'bg-neutral-100 text-neutral-600'}`}>{status}</span>;
  };

  if (selectedContract) {
    return (
      <ContractDetailView
        contract={selectedContract}
        onBack={() => setSelectedContract(null)}
        onRefresh={() => openContractDetail(selectedContract)}
        userId={user?.id || ''}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">

        <button onClick={() => { setFormData({}); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          <Plus className="w-4 h-4" /> New Contract
        </button>
      </div>

      {showForm && (
        <ContractForm
          data={formData}
          onChange={setFormData}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-ink-400 text-sm">Loading contracts...</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-12 bg-white border border-border-custom rounded-2xl">
          <FileText className="w-12 h-12 text-ink-300 mx-auto mb-3" />
          <p className="text-ink-500 text-sm">No revenue contracts yet. Create your first contract to start tracking IFRS 15 revenue recognition.</p>
        </div>
      ) : (
        <div className="bg-white border border-border-custom rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-custom bg-surface-subtle">
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Contract #</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-ink-500 font-medium">Total Value</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">Start Date</th>
                <th className="text-left px-4 py-3 text-ink-500 font-medium">End Date</th>
                <th className="text-right px-4 py-3 text-ink-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} className="border-b border-border-custom hover:bg-surface-subtle/50 cursor-pointer" onClick={() => openContractDetail(c)}>
                  <td className="px-4 py-3 font-medium">{c.contractNumber}</td>
                  <td className="px-4 py-3">{c.customerName || c.customerCode || '—'}</td>
                  <td className="px-4 py-3">{statusBadge(c.status)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtNaira(c.totalContractValue)}</td>
                  <td className="px-4 py-3">{new Date(c.startDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{c.endDate ? new Date(c.endDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); deleteContract(c.id); }} className="p-1.5 text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContractForm({ data, onChange, onSave, onCancel }: { data: any; onChange: (d: any) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="mb-6 bg-white border border-border-custom rounded-2xl p-6">
      <h2 className="text-base font-semibold text-ink-900 mb-4">{data.id ? 'Edit Contract' : 'New Contract'}</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Contract Number</label>
          <input className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.contractNumber || ''} onChange={e => onChange({...data, contractNumber: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Total Value (kobo)</label>
          <input type="number" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.totalContractValue || ''} onChange={e => onChange({...data, totalContractValue: Number(e.target.value)})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Start Date</label>
          <input type="date" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.startDate ? data.startDate.slice(0,10) : ''} onChange={e => onChange({...data, startDate: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">End Date</label>
          <input type="date" className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.endDate ? data.endDate.slice(0,10) : ''} onChange={e => onChange({...data, endDate: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Billing Frequency</label>
          <select className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.billingFrequency || ''} onChange={e => onChange({...data, billingFrequency: e.target.value})}>
            <option value="">Select...</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="milestone">Milestone</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Notes</label>
          <input className="w-full px-3 py-2 border border-border-custom rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.notes || ''} onChange={e => onChange({...data, notes: e.target.value})} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-ink-600 hover:text-ink-900">Cancel</button>
        <button onClick={onSave} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">Save Contract</button>
      </div>
    </div>
  );
}

function ContractDetailView({ contract, onBack, onRefresh, userId }: { contract: Contract; onBack: () => void; onRefresh: () => void; userId: string }) {
  const [obligations, setObligations] = useState<any[]>([]);
  const [showObligationForm, setShowObligationForm] = useState(false);
  const [obForm, setObForm] = useState<any>({});
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);

  useEffect(() => {
    if (contract.id) {
      revenueApi.getObligations(contract.id).then(setObligations);
    }
  }, [contract.id]);

  function loadSchedules(obId: string) {
    setSelectedObligationId(obId);
    revenueApi.getSchedules(obId).then(setSchedules);
  }

  async function saveObligation() {
    try {
      await revenueApi.createObligation({ ...obForm, contractId: contract.id });
      setShowObligationForm(false);
      setObForm({});
      revenueApi.getObligations(contract.id).then(setObligations);
    } catch (err) {
      console.error('Failed to save obligation:', err);
    }
  }

  async function recognizeSchedule(scheduleId: string) {
    setRecognizing(true);
    try {
      await revenueApi.recognizeSchedule(scheduleId, { recognizedDate: new Date().toISOString() });
      loadSchedules(selectedObligationId!);
      onRefresh();
    } catch (err) {
      console.error('Failed to recognize revenue:', err);
    } finally {
      setRecognizing(false);
    }
  }

  async function recognizeAll() {
    setRecognizing(true);
    try {
      await revenueApi.recognizeAll({ asOfDate: new Date().toISOString() });
      if (selectedObligationId) loadSchedules(selectedObligationId);
      onRefresh();
    } catch (err) {
      console.error('Failed to recognize all:', err);
    } finally {
      setRecognizing(false);
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-neutral-100 text-neutral-600',
      active: 'bg-emerald-50 text-emerald-700',
      completed: 'bg-blue-50 text-blue-700',
      cancelled: 'bg-red-50 text-red-600',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || 'bg-neutral-100 text-neutral-600'}`}>{status}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button onClick={onBack} className="text-sm text-ink-500 hover:text-ink-900 mb-4">&larr; Back to Contracts</button>

      <div className="bg-white border border-border-custom rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{contract.contractNumber}</h1>
            <p className="text-sm text-ink-500 mt-1">{contract.customerName || contract.customerCode}</p>
          </div>
          {statusBadge(contract.status)}
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-ink-400">Value:</span> <span className="font-mono font-medium">{fmtNaira(contract.totalContractValue)}</span></div>
          <div><span className="text-ink-400">Start:</span> {new Date(contract.startDate).toLocaleDateString()}</div>
          <div><span className="text-ink-400">End:</span> {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : '—'}</div>
          <div><span className="text-ink-400">Billing:</span> {contract.billingFrequency || '—'}</div>
          <div><span className="text-ink-400">Currency:</span> {contract.currency}</div>
        </div>
      </div>

      <div className="bg-white border border-border-custom rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink-900">Performance Obligations</h2>
          <button onClick={() => setShowObligationForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700"><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>

        {showObligationForm && (
          <div className="mb-4 p-4 bg-neutral-50 border border-border-custom rounded-xl">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink-600 mb-1">Description</label>
                <input className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" value={obForm.description || ''} onChange={e => setObForm({...obForm, description: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Amount (kobo)</label>
                <input type="number" className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" value={obForm.amount || ''} onChange={e => setObForm({...obForm, amount: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Timing</label>
                <select className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" value={obForm.timing || ''} onChange={e => setObForm({...obForm, timing: e.target.value})}>
                  <option value="">Select...</option>
                  <option value="point_in_time">Point in Time</option>
                  <option value="over_time">Over Time</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Revenue Account ID</label>
                <input className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" value={obForm.revenueAccountId || ''} onChange={e => setObForm({...obForm, revenueAccountId: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Recognition Method</label>
                <select className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" value={obForm.recognitionMethod || 'straight_line'} onChange={e => setObForm({...obForm, recognitionMethod: e.target.value})}>
                  <option value="straight_line">Straight Line</option>
                  <option value="milestone">Milestone</option>
                  <option value="percentage_of_completion">% of Completion</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Start Date</label>
                <input type="date" className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" value={obForm.startDate ? obForm.startDate.slice(0,10) : ''} onChange={e => setObForm({...obForm, startDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">End Date</label>
                <input type="date" className="w-full px-3 py-2 border border-border-custom rounded-lg text-sm" value={obForm.endDate ? obForm.endDate.slice(0,10) : ''} onChange={e => setObForm({...obForm, endDate: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowObligationForm(false)} className="px-3 py-1.5 text-xs text-ink-600">Cancel</button>
              <button onClick={saveObligation} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg">Save</button>
            </div>
          </div>
        )}

        {obligations.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-6">No performance obligations. Add one to start tracking.</p>
        ) : (
          <div className="space-y-3">
            {obligations.map(ob => (
              <div key={ob.id} className="border border-border-custom rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ob.description}</span>
                    {statusBadge(ob.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadSchedules(ob.id)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"><Calendar className="w-3.5 h-3.5 inline mr-1" />Schedules</button>
                    {ob.timing === 'point_in_time' && selectedObligationId === ob.id && schedules.filter(s => s.status === 'pending').length > 0 && (
                      <button onClick={recognizeAll} disabled={recognizing} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-100">
                        {recognizing ? 'Recognizing...' : 'Recognize All'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-ink-400">
                  <span>Amount: <span className="font-mono text-ink-600">{fmtNaira(ob.amount)}</span></span>
                  <span>Recognized: <span className="font-mono text-emerald-600">{fmtNaira(ob.recognizedAmount)}</span></span>
                  <span>Remaining: <span className="font-mono text-amber-600">{fmtNaira(ob.remainingAmount)}</span></span>
                  <span>Timing: {ob.timing === 'point_in_time' ? 'Point' : 'Over Time'}</span>
                  <span>Method: {ob.recognitionMethod}</span>
                </div>

                {selectedObligationId === ob.id && schedules.length > 0 && (
                  <div className="mt-3 border-t border-border-custom pt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-ink-400">
                          <th className="text-left pb-1">Date</th>
                          <th className="text-right pb-1">Amount</th>
                          <th className="text-right pb-1">Recognized</th>
                          <th className="text-center pb-1">Status</th>
                          <th className="text-right pb-1">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map(s => (
                          <tr key={s.id} className="border-t border-border-custom/50">
                            <td className="py-1.5">{new Date(s.scheduledDate).toLocaleDateString()}</td>
                            <td className="text-right font-mono">{fmtNaira(s.amount)}</td>
                            <td className="text-right font-mono">{fmtNaira(s.recognizedAmount)}</td>
                            <td className="text-center">
                              {s.status === 'recognized' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 inline" /> : s.status === 'skipped' ? <XCircle className="w-3.5 h-3.5 text-red-400 inline" /> : <Clock className="w-3.5 h-3.5 text-amber-400 inline" />}
                            </td>
                            <td className="text-right">
                              {s.status === 'pending' && (
                                <button onClick={() => recognizeSchedule(s.id)} disabled={recognizing} className="text-emerald-600 hover:text-emerald-700 font-medium">
                                  Recognize
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
