/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankingApi } from '../../lib/api';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuth } from '../../hooks/useAuth';
import {
  Plus,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ChevronRight,
  Trash2,
  Edit2,
  X,
  PlusCircle,
  HelpCircle,
  Clock,
  BookOpen,
  CheckCircle,
  Filter,
  CheckSquare,
  ArrowLeft
} from 'lucide-react';

export function BankRules() {
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();

  // Drawer states
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form states
  const [ruleName, setRuleName] = useState('');
  const [priority, setPriority] = useState(1);
  const [isActive, setIsActive] = useState(true);

  // Conditions list (starts with one condition element)
  const [conditions, setConditions] = useState<Array<{
    field: 'description' | 'amount' | 'type';
    operator: 'contains' | 'starts_with' | 'ends_with' | 'equals' | 'amount_range' | 'credit_or_debit';
    value: string;
    valueMin: string;
    valueMax: string;
  }>>([
    { field: 'description', operator: 'contains', value: '', valueMin: '', valueMax: '' }
  ]);

  // Actions configurations
  const [actionCategory, setActionCategory] = useState('');
  const [actionAccountId, setActionAccountId] = useState('');

  // 1. Fetch rules from database
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['bankRules'],
    queryFn: bankingApi.getRules,
    enabled: !!token,
  });

  // 2. Fetch general ledger accounts to pair for actions categorisation
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glCashAccounts'],
    queryFn: bankingApi.getGLAccounts,
    enabled: !!token,
  });

  const expenseGLAccounts = glAccounts.filter((acc: any) => acc.type === 'expense' || acc.type === 'asset');

  // 3. Create Rule Mutation
  const createRuleMutation = useMutation({
    mutationFn: bankingApi.createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankRules'] });
      setShowDrawer(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(`Failed to save automation rule: ${err.message}`);
    }
  });

  // 4. Update Rule Mutation
  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => bankingApi.updateRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankRules'] });
      setShowDrawer(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(`Failed to update automation rule: ${err.message}`);
    }
  });

  // 5. Delete Rule Mutation
  const deleteRuleMutation = useMutation({
    mutationFn: bankingApi.deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankRules'] });
    },
    onError: (err: any) => {
      alert(`Failed to delete rule: ${err.message}`);
    }
  });

  // 6. Inline Toggle Active Status Mutation
  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActiveValue }: { id: string; isActiveValue: boolean }) =>
      bankingApi.updateRule(id, { isActive: isActiveValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankRules'] });
    }
  });

  const resetForm = () => {
    setRuleName('');
    setPriority(1);
    setIsActive(true);
    setConditions([{ field: 'description', operator: 'contains', value: '', valueMin: '', valueMax: '' }]);
    setActionCategory('');
    setActionAccountId('');
    setEditingRuleId(null);
  };

  const openNewRuleDrawer = () => {
    resetForm();
    setEditingRuleId(null);
    setShowDrawer(true);
  };

  const openEditRuleDrawer = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setPriority(rule.priority || 1);
    setIsActive(rule.isActive !== false);

    // Map condition logic tree
    if (rule.conditions && Array.isArray(rule.conditions)) {
      setConditions(rule.conditions.map((c: any) => ({
        field: c.field || 'description',
        operator: c.operator || 'contains',
        value: c.value || '',
        valueMin: c.valueMin || '',
        valueMax: c.valueMax || ''
      })));
    } else if (rule.conditions) {
      // Fallback single condition
      setConditions([{
        field: rule.conditions.field || 'description',
        operator: rule.conditions.operator || 'contains',
        value: rule.conditions.value || '',
        valueMin: rule.conditions.valueMin || '',
        valueMax: rule.conditions.valueMax || ''
      }]);
    } else {
      setConditions([{ field: 'description', operator: 'contains', value: '', valueMin: '', valueMax: '' }]);
    }

    // Map actions
    setActionCategory(rule.actions?.category || '');
    setActionAccountId(rule.actions?.accountId || '');
    setShowDrawer(true);
  };

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      { field: 'description', operator: 'contains', value: '', valueMin: '', valueMax: '' }
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length === 1) return;
    setConditions(conditions.filter((_, idx) => idx !== index));
  };

  const handleConditionChange = (index: number, key: string, val: string) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [key]: val };
    setConditions(updated);
  };

  const handleSubmittingRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return alert('Automated Rule display name is required.');
    if (!actionAccountId) return alert('You must select a classification account for categorization.');

    const selectedAccount = expenseGLAccounts.find((a: any) => a.id === actionAccountId);
    const categoryName = actionCategory || (selectedAccount ? selectedAccount.name : 'Automated Allocation');

    const formattedConditions = conditions.map((c) => ({
      field: c.field,
      operator: c.operator,
      value: c.value,
      valueMin: c.valueMin,
      valueMax: c.valueMax
    }));

    const formattedActions = {
      category: categoryName,
      accountId: actionAccountId
    };

    const payload = {
      name: ruleName,
      conditions: formattedConditions,
      actions: formattedActions,
      priority: Number(priority),
      isActive: isActive
    };

    if (editingRuleId) {
      updateRuleMutation.mutate({ id: editingRuleId, data: payload });
    } else {
      createRuleMutation.mutate(payload);
    }
  };

  const handleDeleteRule = (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete rule "${name}"?`)) {
      deleteRuleMutation.mutate(id);
    }
  };

  const formatConditionsSummary = (conditionsObj: any) => {
    if (!conditionsObj) return 'No conditional rules configured.';
    const arr = Array.isArray(conditionsObj) ? conditionsObj : [conditionsObj];

    return arr.map((c: any, index: number) => {
      let phrase = '';
      if (c.field === 'description') {
        phrase = `Description ${c.operator.replace('_', ' ')} "${c.value}"`;
      } else if (c.field === 'type') {
        phrase = `Direction equals "${c.value || 'debit'}"`;
      } else if (c.field === 'amount') {
        if (c.operator === 'amount_range') {
          phrase = `Amount ranges between ₦${c.valueMin} and ₦${c.valueMax}`;
        } else {
          phrase = `Amount equals ₦${c.value}`;
        }
      }
      return (
        <span key={index} className="inline-flex items-center gap-0.5 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 font-mono text-[10px] text-slate-600 block sm:inline mr-1 mb-1 shadow-xs">
          {phrase}
        </span>
      );
    });
  };

  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-1 lg:p-4 font-sans">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/banking')}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">Automation Rules</h1>
            <p className="text-xs text-slate-500 mt-1">
              Build rules to automatically categorise bank deposits and expenses based on statement narration descriptions.
            </p>
          </div>
        </div>

        <button
          id="btn-create-rule"
          onClick={openNewRuleDrawer}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition shadow-sm cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Rule</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-sans">
          <Clock className="w-6 h-6 mx-auto mb-2 animate-spin text-slate-300" />
          Reading automated categorization policies...
        </div>
      ) : rules.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200/65 rounded-xl px-4 shadow-xs">
          <BookOpen className="w-10 h-10 text-indigo-500 mx-auto mb-3.5" />
          <h3 className="font-sans font-bold text-slate-950 text-xs">No Active Rules</h3>
          <p className="font-sans text-[11px] text-slate-400 mt-1 max-w-sm mx-auto mb-4 leading-normal">
            Automating transaction categorization saves accounting hours. Add an UBER rule keyword to try it out!
          </p>
          <button
            onClick={openNewRuleDrawer}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold uppercase text-[10px]"
          >
            Create First Rule
          </button>
        </div>
      ) : (
        /* Rules Listing as Premium Cards */
        <div className="grid grid-cols-1 gap-4" id="rules-cards-list">
          {rules.map((rule: any) => {
            const pairedGL = glAccounts.find((a: any) => a.id === rule.actions?.accountId);

            return (
              <div
                key={rule.id}
                id={`rule-card-${rule.id}`}
                className={`bg-white border rounded-xl overflow-hidden p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition shadow-xs hover:shadow-sm ${
                  rule.isActive === false ? 'border-slate-200/60 opacity-65' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Left metadata */}
                <div className="space-y-2.5 flex-1 select-none">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-950 text-sm">{rule.name}</h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-medium">
                      Priority: {rule.priority || 0}
                    </span>
                  </div>

                  {/* Conditions summarizer */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block mb-1">When Feed matches:</span>
                    <div className="flex flex-wrap items-center mt-1">
                      {formatConditionsSummary(rule.conditions)}
                    </div>
                  </div>

                  {/* Action summarizer */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block mb-0.5">Then categorise to ledger:</span>
                    <div className="text-xs font-bold text-slate-800">
                      → {rule.actions?.category || 'Automated category'}{' '}
                      <span className="font-mono text-[10px] font-medium text-indigo-600">
                        ({pairedGL ? `${pairedGL.code} ${pairedGL.name}` : 'Unpaired general ledger account'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 shrink-0">
                  {/* Toggle Active Status */}
                  <button
                    type="button"
                    onClick={() =>
                      toggleRuleMutation.mutate({
                        id: rule.id,
                        isActiveValue: rule.isActive === false
                      })
                    }
                    className="text-slate-400 hover:text-slate-600 transition"
                    title={rule.isActive === false ? 'Enable rule' : 'Disable rule'}
                  >
                    {rule.isActive === false ? (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    ) : (
                      <ToggleRight className="w-8 h-8 text-indigo-600" />
                    )}
                  </button>

                  <button
                    onClick={() => openEditRuleDrawer(rule)}
                    className="p-1 px-1.5 border border-slate-200 hover:bg-slate-50 rounded text-slate-600 hover:text-slate-950"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteRule(rule.id, rule.name)}
                    className="p-1 px-1.5 border border-slate-100 rounded text-rose-500 hover:bg-rose-50 hover:border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DRAWER RULE EDITOR */}
      {showDrawer && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white h-screen max-w-md w-full shadow-2xl flex flex-col border-l border-slate-100 animate-slide-in">
            {/* Header toolbar */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                {editingRuleId ? 'Modify Automation Policy' : 'Configure Custom Rule'}
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition animate-hover-pulse"
                onClick={() => setShowDrawer(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form desk */}
            <form onSubmit={handleSubmittingRule} className="p-5 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Rule Display Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Uber Ride Expenses"
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      className="w-full text-xs font-sans border border-slate-200 rounded px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Priority weight
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      className="w-full text-xs font-sans border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Conditions Block */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                      IF FEED STATEMENT MATCHES (AND):
                    </label>
                    <button
                      type="button"
                      onClick={handleAddCondition}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> ADD STATEMENT RULE
                    </button>
                  </div>

                  {conditions.map((cond, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-2.5 relative">
                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(idx)}
                          className="absolute right-2 top-2 p-1 text-slate-400 hover:text-rose-500 hover:bg-white rounded hover:shadow-xs transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {/* Field matching targeting */}
                        <div>
                          <label className="text-[8px] uppercase font-bold text-slate-400 font-sans block mb-0.5">Field Element</label>
                          <select
                            value={cond.field}
                            onChange={(e) => handleConditionChange(idx, 'field', e.target.value)}
                            className="w-full text-[11px] font-sans border border-slate-100 rounded px-2 py-1 bg-white text-slate-800 focus:outline-none"
                          >
                            <option value="description">Narration Description</option>
                            <option value="amount">Transaction Amount</option>
                            <option value="type">Accounting Direction (type)</option>
                          </select>
                        </div>

                        {/* Matching Operator selection */}
                        <div>
                          <label className="text-[8px] uppercase font-bold text-slate-400 font-sans block mb-0.5">Operator Logic</label>
                          <select
                            value={cond.operator}
                            onChange={(e) => handleConditionChange(idx, 'operator', e.target.value)}
                            className="w-full text-[11px] font-sans border border-slate-100 rounded px-2 py-1 bg-white text-slate-800 focus:outline-none"
                          >
                            {cond.field === 'description' && (
                              <>
                                <option value="contains">Contains text</option>
                                <option value="starts_with">Starts with</option>
                                <option value="ends_with">Ends with</option>
                                <option value="equals">Exactly equals</option>
                              </>
                            )}
                            {cond.field === 'type' && (
                              <option value="equals">Equals flow direction</option>
                            )}
                            {cond.field === 'amount' && (
                              <>
                                <option value="equals">Exactly equals (kobo)</option>
                                <option value="amount_range">Amount brackets range (Naira)</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* Value inputs based on element operator */}
                        <div className="col-span-2">
                          <label className="text-[8px] uppercase font-bold text-slate-400 font-sans block mb-1">Expected Match Value</label>

                          {cond.field === 'type' ? (
                            <select
                              value={cond.value}
                              onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                              className="w-full text-xs font-sans border border-slate-200 bg-white rounded px-3 py-1.5 focus:outline-none"
                            >
                              <option value="debit">Debit (Disbursements/Money Out)</option>
                              <option value="credit">Credit (Deposits/Money In)</option>
                            </select>
                          ) : cond.operator === 'amount_range' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="Min Naira (₦)"
                                value={cond.valueMin}
                                onChange={(e) => handleConditionChange(idx, 'valueMin', e.target.value)}
                                className="w-full text-xs font-sans border border-slate-200 rounded px-2 py-1.5 focus:outline-none"
                              />
                              <span className="text-slate-400 text-xs">to</span>
                              <input
                                type="number"
                                placeholder="Max Naira (₦)"
                                value={cond.valueMax}
                                onChange={(e) => handleConditionChange(idx, 'valueMax', e.target.value)}
                                className="w-full text-xs font-sans border border-slate-200 rounded px-2 py-1.5 focus:outline-none"
                              />
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder={cond.field === 'amount' ? 'Expected amount in Kobo' : 'e.g. UBER, BOLT, INTEREST'}
                              value={cond.value}
                              onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                              className="w-full text-xs font-sans border border-slate-200 rounded px-3 py-1.5 focus:outline-none"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions categorization pairing elements */}
                <div className="space-y-3.5 border-t border-slate-100 pt-4 pb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans block">
                    THEN CATEGORISE AS AND ASSIGN TO LEDGER:
                  </label>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">
                        General Ledger Account Assignment
                      </label>
                      <select
                        required
                        value={actionAccountId}
                        onChange={(e) => setActionAccountId(e.target.value)}
                        className="w-full text-xs font-sans border border-slate-200 bg-white rounded px-3 py-2 text-slate-800 focus:outline-none"
                      >
                        <option value="">-- Select double-entry ledger assignment --</option>
                        {expenseGLAccounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code ? `${acc.code} ` : ''}{acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1 text-slate-400">
                        Visual Category Label (Optional block)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Transportation, Digital Utilities"
                        value={actionCategory}
                        onChange={(e) => setActionCategory(e.target.value)}
                        className="w-full text-xs font-sans border border-slate-200 rounded px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1.5">
                        Defaults to match target general ledger account name details if empty.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer footer controls */}
              <div className="flex gap-2.5 bg-slate-50 p-4 border-t border-slate-100 max-w-sm w-full mx-[-20px] mb-[-20px] self-end mt-10">
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  className="flex-1 py-2 text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-600 rounded inline-flex items-center justify-center cursor-pointer"
                >
                  Discard Close
                </button>
                <button
                  type="submit"
                  disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                  className="flex-grow py-2 text-xs font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors uppercase inline-flex items-center justify-center cursor-pointer"
                >
                  {createRuleMutation.isPending || updateRuleMutation.isPending ? 'Saving...' : 'Deploy Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default BankRules;
