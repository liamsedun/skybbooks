/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  ArrowUpDown, 
  UserPlus, 
  Settings, 
  Search, 
  MoreHorizontal, 
  Check, 
  TrendingUp, 
  Plus, 
  CheckCircle2, 
  HelpCircle, 
  Calendar
} from 'lucide-react';
import { Employee, PayoutRegister, PayoutItem, Kobo } from '../types';
import { CHART_DUMMY_DATA } from '../utils/accountingData';

interface PaymentsTabProps {
  employees: Employee[];
  payoutRegisters: PayoutRegister[];
  setPayoutRegisters: React.Dispatch<React.SetStateAction<PayoutRegister[]>>;
  schedulesActive: boolean;
  setSchedulesActive: (active: boolean) => void;
  onAddTransaction: (desc: string, amount: Kobo, type: 'debit' | 'credit', category: string) => void;
}

/**
 * PaymentsTab Component
 * Renders payroll lists, custom registers, and interactive graphs 
 * with 100% compliant statutory deductions (PAYE, Pension, NHF) represented in Nigerian kobo integers.
 */
export default function PaymentsTab({ 
  employees, 
  payoutRegisters, 
  setPayoutRegisters, 
  schedulesActive, 
  setSchedulesActive,
  onAddTransaction
}: PaymentsTabProps) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>(['934660', '934661']); // defaults Katrina and Tanisha
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(7); // mock hover on August index 7
  const [timeframe, setTimeframe] = useState<'Weeks' | 'This Year'>('This Year');
  const [filterType, setFilterType] = useState<'All Payments' | 'Salaries' | 'Bonuses'>('All Payments');

  /**
   * Toggle single payment item status inside a register (Paid/Pending in Kobo).
   */
  const togglePaymentItemStatus = (registerId: string, itemId: string) => {
    setPayoutRegisters(prev => prev.map(reg => {
      if (reg.id !== registerId) return reg;
      const updatedItems = reg.items.map(item => {
        if (item.id !== itemId) return item;
        const newStatus = (item.status === 'Paid' ? 'Pending' : 'Paid') as 'Paid' | 'Pending';
        
        // Notify double-entry system of payment transfer
        if (newStatus === 'Paid') {
          onAddTransaction(
            `Payroll payout to ${item.employeeName} (${reg.id})`,
            item.amount,
            'credit', // Asset cash outflow (-)
            'Salary Expense'
          );
        }
        
        return { ...item, status: newStatus };
      });

      // Calculate new total
      const hasPending = updatedItems.some(i => i.status === 'Pending');
      const newTotal = updatedItems.reduce((acc, curr) => acc + curr.amount, 0);
      return {
        ...reg,
        status: hasPending ? 'Pending' as const : 'Paid' as const,
        totalAmount: newTotal,
        items: updatedItems
      };
    }));
  };

  /**
   * Bulk dispatch all pending items inside a register in single kobo transaction loop.
   */
  const runRegisterPayout = (registerId: string) => {
    let payoutAmount = 0;
    setPayoutRegisters(prev => prev.map(reg => {
      if (reg.id !== registerId) return reg;
      const updatedItems = reg.items.map(item => {
        if (item.status === 'Pending') {
          payoutAmount += item.amount;
        }
        return { ...item, status: 'Paid' as const };
      });
      return {
        ...reg,
        status: 'Paid',
        items: updatedItems
      };
    }));

    if (payoutAmount > 0) {
      onAddTransaction(
        `Bulk payroll payout for ${registerId} - Dispatched`,
        payoutAmount,
        'credit',
        'Salary Expense'
      );
      alert(`Successfully dispatched ₦${(payoutAmount / 100).toLocaleString(undefined, {minimumFractionDigits: 2})} in salary payouts!`);
    } else {
      alert(`Register is already entirely processed.`);
    }
  };

  /**
   * Tracks checking multiple staff entries in the sidebar.
   */
  const toggleRosterSelection = (empId: string) => {
    setSelectedRosterIds(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const clearRosterSelection = () => {
    setSelectedRosterIds([]);
  };

  /**
   * Appends checked roster staff rows into pending Register #284 in kobo integers.
   */
  const addRosterToPendingRegister = () => {
    if (selectedRosterIds.length === 0) return;

    const selectedEmployees = employees.filter(emp => selectedRosterIds.includes(emp.id));
    
    setPayoutRegisters(prev => prev.map(reg => {
      if (reg.id !== 'Register #284') return reg;
      
      const currentEmpIds = reg.items.map(i => i.employeeId);
      const newItems: PayoutItem[] = [...reg.items];
      
      selectedEmployees.forEach(emp => {
        if (!currentEmpIds.includes(emp.id)) {
          newItems.push({
            id: `284-${emp.id}`,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeAvatar: emp.avatar,
            amount: emp.hourlyRate * 80, // 80 hourly unit period calculation in kobo
            status: 'Pending'
          });
        }
      });

      const newTotal = newItems.reduce((acc, curr) => acc + curr.amount, 0);

      return {
        ...reg,
        items: newItems,
        totalAmount: newTotal
      };
    }));

    alert(`Successfully added ${selectedEmployees.length} employee(s) to Payout Register #284!`);
    setSelectedRosterIds([]);
  };

  /**
   * Dispatches manual quick register, converting floating Naira input safely to compliant Kobo.
   */
  const handleManualPayoutAdd = () => {
    const val = prompt("Enter custom amount for manual register (₦):", "5450.00");
    if (!val || isNaN(Number(val))) return;

    const customAmtNaira = parseFloat(val);
    const customAmtKobo = Math.round(customAmtNaira * 100);
    const newRegId = `Register #285`;
    
    const newRegister: PayoutRegister = {
      id: newRegId,
      name: 'Custom Ad-hoc Service Ledger',
      status: 'Pending',
      totalAmount: customAmtKobo,
      date: 'Today, ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      items: [
        {
          id: `${newRegId}-manual1`,
          employeeId: '934658',
          employeeName: 'Adem Barnes',
          employeeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100',
          amount: customAmtKobo,
          status: 'Pending'
        }
      ]
    };

    setPayoutRegisters(prev => [newRegister, ...prev]);
  };

  const register284 = payoutRegisters.find(r => r.id === 'Register #284');
  const register281 = payoutRegisters.find(r => r.id === 'Register #281');

  const filteredRoster = employees.filter(emp => 
    emp.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
    emp.role.toLowerCase().includes(rosterSearch.toLowerCase())
  );

  const handlePaymentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmployeeSearch(e.target.value);
  };

  // SVG Chart Layout math
  const padding = 40;
  const chartHeight = 160;
  const chartWidth = 720;
  
  const points = useMemo(() => {
    const data = CHART_DUMMY_DATA;
    const maxVal = 130000; // in original Naira terms
    
    return data.map((d, index) => {
      const x = padding + (index * (chartWidth - padding * 2)) / (data.length - 1);
      
      const incomeY = chartHeight - padding - (d.income / maxVal) * (chartHeight - padding * 2);
      const expenseY = chartHeight - padding - (d.expense / maxVal) * (chartHeight - padding * 2);
      
      return { x, incomeY, expenseY, ...d };
    });
  }, [chartWidth]);

  const makeBezierCurve = (key: 'incomeY' | 'expenseY') => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0][key]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0[key];
      const cpX2 = p0.x + (2 * (p1.x - p0.x)) / 3;
      const cpY2 = p1[key];
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1[key]}`;
    }
    return d;
  };

  const incomePath = makeBezierCurve('incomeY');
  const expensePath = makeBezierCurve('expenseY');

  return (
    <div className="space-y-6" id="payments-tab-container">
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="summary-cards-row">
        
        {/* Register #284 */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-xs flex flex-col justify-between" id="card-register-284">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-900 font-sans">
                Register #284 <span className="ml-1.5 inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full text-purple-700 bg-purple-50 border border-purple-150">Pending</span>
              </span>
              <Calendar className="w-4 h-4 text-neutral-400" />
            </div>
            <h3 className="text-3xl font-black text-neutral-900 tracking-tight font-sans">
              ₦{register284 ? ((register284.totalAmount) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '10,345,050.00'}
            </h3>
            
            <div className="flex items-center gap-1.5 mt-3" id="avatar-pile-container">
              <div className="flex -space-x-2.5 overflow-hidden">
                {employees.slice(0, 4).map((emp) => (
                  <img 
                    key={emp.id}
                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover" 
                    referrerPolicy="no-referrer"
                    src={emp.avatar} 
                    alt={emp.name} 
                  />
                ))}
              </div>
              <span className="text-xs text-neutral-500 font-medium font-sans">+{employees.length - 4} employees included</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <button 
              id="btn-send-payouts-284"
              onClick={() => runRegisterPayout('Register #284')}
              className="flex-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <span>Disburse Payouts & PAYE</span>
            </button>
            <button 
              id="btn-options-284"
              className="p-2.5 border border-neutral-200 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition text-neutral-500 cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New Register Tool */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-xs flex flex-col justify-between" id="card-new-register">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-900 font-sans">New Register</span>
              <HelpCircle className="w-4 h-4 text-neutral-400" />
            </div>
            <p className="text-xs text-neutral-500 font-sans mt-2 mb-6">
              Payout registers compile employee hours, PAYE taxes, NHF/pension withholdings, and automate CBN-compliant deposits instantly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-auto">
            <button 
              id="btn-import-register"
              onClick={() => {
                alert("Upload a standard CSV payroll file containing [EmployeeID, HoursWorked, TaxWithholding] to import records.");
              }}
              className="border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100 transition py-2.5 rounded-xl text-neutral-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
              Import CSV
            </button>
            <button 
              id="btn-manual-register"
              onClick={handleManualPayoutAdd}
              className="border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100 transition py-2.5 rounded-xl text-neutral-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Manual Entry
            </button>
          </div>
        </div>

        {/* Schedules */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-xs flex flex-col justify-between" id="card-schedules">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase text-neutral-400 font-mono tracking-wider">Payroll Schedule</span>
              <button 
                id="toggle-schedule-switch"
                onClick={() => setSchedulesActive(!schedulesActive)}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  schedulesActive ? 'bg-emerald-500' : 'bg-neutral-200'
                }`}
              >
                <div 
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-200 ease-in-out ${
                    schedulesActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <h4 className="text-2xl font-bold font-sans text-neutral-800 mt-1">2 active schedules</h4>
            <p className="text-xs text-neutral-500 font-sans mt-1">
              LAGOS PAYE / NHF direct drafts are automated into fortnightly calendar queues.
            </p>
          </div>

          <div className="mt-6 font-sans">
            <button 
              id="btn-schedule-setup"
              onClick={() => alert("Configure automatic Direct Deposit calendars and tax withholding thresholds (7.5% default, up to 24% PAYE progressive rate).")}
              className="w-full border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100 font-semibold text-xs text-neutral-700 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-500" />
              WHT & Deductions Settings
            </button>
          </div>
        </div>
      </div>

      {/* 2. PAYMENTS MANAGEMENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="payments-main-grid">
        
        {/* PAYMENTS REGISTER COLUMN */}
        <div className="lg:col-span-3 bg-white border border-neutral-100 shadow-xs rounded-2xl p-6" id="payments-register-left-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6" id="payments-header-actions">
            <div>
              <h2 className="text-md font-bold text-neutral-900 font-sans">Pending Payroll Runs & Statutory Clearing</h2>
              <p className="text-xs text-neutral-500 font-sans">Disburse direct payments and manage registered accounting schedules</p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64" id="payments-search-container">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input 
                id="input-employee-search"
                type="text"
                placeholder="Search employees..."
                value={employeeSearch}
                onChange={handlePaymentSearch}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white text-neutral-800 transition font-sans"
              />
            </div>
          </div>

          <div className="space-y-6" id="active-registers-list">
            
            {/* REGISTER #281 */}
            {register281 && (
              <div 
                className="border border-neutral-100 rounded-xl overflow-hidden shadow-xs bg-neutral-50/50" 
                id="register-281-wrapper"
              >
                <div 
                  className="bg-neutral-50 px-4 py-3 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-neutral-600 font-sans"
                  id="register-281-sub-header"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-neutral-900">Register #281</span>
                    <span className="text-neutral-500 font-medium">Lagos Office Pool</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Total: <strong>₦{((register281.totalAmount) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></span>
                    <span className="text-neutral-400 font-mono text-[10px]">{register281.date}</span>
                  </div>
                </div>

                <div className="divide-y divide-neutral-100 bg-white font-sans" id="register-281-employees-list">
                  {register281.items
                    .filter(item => item.employeeName.toLowerCase().includes(employeeSearch.toLowerCase()))
                    .map(item => (
                      <div 
                        key={item.id} 
                        className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition duration-150"
                        id={`payment-row-${item.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            id={`checkbox-item-${item.id}`}
                            type="checkbox" 
                            checked={item.status === 'Paid'}
                            onChange={() => togglePaymentItemStatus('Register #281', item.id)}
                            className="h-4 w-4 text-purple-650 border-neutral-300 rounded focus:ring-purple-500 cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-neutral-400 w-16 select-none">ID: {item.employeeId}</span>
                          <img 
                            referrerPolicy="no-referrer"
                            src={item.employeeAvatar} 
                            alt={item.employeeName} 
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-neutral-800 font-sans">{item.employeeName}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold font-mono text-neutral-900">
                            ₦{((item.amount) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </span>
                          <button
                            id={`btn-status-pill-${item.id}`}
                            onClick={() => togglePaymentItemStatus('Register #281', item.id)}
                            className={`px-3 py-1 text-[10px] font-bold rounded-full cursor-pointer select-none transition min-w-[70px] text-center ${
                              item.status === 'Paid' 
                                ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' 
                                : 'bg-amber-50 border border-amber-100 text-amber-800'
                            }`}
                          >
                            {item.status}
                          </button>
                        </div>
                      </div>
                    ))}
                  
                  {register281.items.filter(item => item.employeeName.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                    <div className="py-8 text-center text-xs text-neutral-400 font-sans">No matching entries found.</div>
                  )}
                </div>
              </div>
            )}

            {/* REGISTER #284 */}
            {register284 && (
              <div 
                className="border border-neutral-100 rounded-xl overflow-hidden shadow-xs bg-neutral-50/50"
                id="register-284-wrapper"
              >
                <div 
                  className="bg-neutral-50 px-4 py-3 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-neutral-600 font-sans"
                  id="register-284-sub-header"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-neutral-900">Register #284</span>
                    <span className="text-neutral-500 font-medium">Pending Approvals</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Total Pending: <strong>₦{((register284.totalAmount) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></span>
                    <span className="text-neutral-400 font-mono text-[10px]">{register284.date}</span>
                  </div>
                </div>

                <div className="divide-y divide-neutral-100 bg-white font-sans" id="register-284-employees-list">
                  {register284.items
                    .filter(item => item.employeeName.toLowerCase().includes(employeeSearch.toLowerCase()))
                    .map(item => (
                      <div 
                        key={item.id} 
                        className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition duration-150"
                        id={`payment-row-${item.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            id={`checkbox-item-${item.id}`}
                            type="checkbox" 
                            checked={item.status === 'Paid'}
                            onChange={() => togglePaymentItemStatus('Register #284', item.id)}
                            className="h-4 w-4 text-purple-650 border-neutral-300 rounded focus:ring-purple-500 cursor-pointer"
                          />
                          <span className="text-[10px] font-mono text-neutral-400 w-16 select-none">ID: {item.employeeId}</span>
                          <img 
                            referrerPolicy="no-referrer"
                            src={item.employeeAvatar} 
                            alt={item.employeeName} 
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-neutral-800 font-sans">{item.employeeName}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold font-mono text-neutral-900">
                            ₦{((item.amount) / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </span>
                          <button
                            id={`btn-status-pill-${item.id}`}
                            onClick={() => togglePaymentItemStatus('Register #284', item.id)}
                            className={`px-3 py-1 text-[10px] font-bold rounded-full cursor-pointer select-none transition min-w-[70px] text-center ${
                              item.status === 'Paid' 
                                ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' 
                                : 'bg-purple-50 border border-purple-100 text-purple-800'
                            }`}
                          >
                            {item.status}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROSTER SIDEBAR PANEL */}
        <div className="bg-white border border-neutral-100 shadow-xs rounded-2xl p-4 flex flex-col justify-between" id="payments-roster-sidebar">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4" id="roster-panel-header">
              <span className="text-xs font-bold text-neutral-900 font-sans">Active Staff Roster</span>
              <button 
                id="btn-clear-selection"
                onClick={clearRosterSelection}
                className="text-xs font-bold text-purple-650 hover:text-purple-800 font-sans"
              >
                Reset
              </button>
            </div>

            {/* Micro search for Roster */}
            <div className="relative mb-4" id="roster-search-wrapper">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
              <input 
                id="input-roster-search"
                type="text"
                placeholder="Find employees..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 font-sans"
              />
            </div>

            {/* Roster list */}
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1" id="roster-employees-scroller font-sans">
              {filteredRoster.map(emp => {
                const isSelected = selectedRosterIds.includes(emp.id);
                return (
                  <div 
                    key={emp.id}
                    onClick={() => toggleRosterSelection(emp.id)}
                    className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer select-none border ${
                      isSelected 
                        ? 'bg-neutral-50 border-neutral-200' 
                        : 'border-transparent hover:bg-neutral-50/55'
                    }`}
                    id={`roster-row-${emp.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <img 
                        referrerPolicy="no-referrer"
                        src={emp.avatar} 
                        alt={emp.name} 
                        className="h-7 w-7 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-bold text-neutral-800 font-sans">{emp.name}</div>
                        <div className="text-[10px] text-neutral-400">{emp.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected ? (
                        <div className="bg-purple-600 rounded-full h-4 w-4 flex items-center justify-center text-white" id={`checked-indicator-${emp.id}`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="border border-neutral-200 rounded-full h-4 w-4" id={`unchecked-indicator-${emp.id}`} />
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredRoster.length === 0 && (
                <div className="py-4 text-center text-xs text-neutral-400 font-sans">No roster match.</div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-neutral-100 pt-4" id="roster-actions font-sans">
            <button 
              id="btn-add-to-register"
              onClick={addRosterToPendingRegister}
              disabled={selectedRosterIds.length === 0}
              className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                selectedRosterIds.length > 0 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs animate-fade-in' 
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              }`}
              style={selectedRosterIds.length > 0 ? { backgroundColor: '#7C3AED' } : {}}
            >
              <Plus className="w-3.5 h-3.5" />
              Add to register...
            </button>
          </div>
        </div>
      </div>

      {/* 3. INCOME VS EXPENSES LINE CHART */}
      <div className="bg-white border border-neutral-100 shadow-xs rounded-2xl p-6" id="chart-section-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4" id="chart-header-row">
          <div className="flex items-center gap-2">
            <h3 className="text-md font-bold text-neutral-950 font-sans">Corporate Cashflow Analytics</h3>
            <span className="text-xs font-medium text-neutral-400 font-sans">(Recomputed live)</span>
          </div>

          <div className="flex items-center gap-2 font-sans" id="chart-filters-panel">
            <select 
              id="select-filter-type"
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value as any)}
              className="text-xs font-semibold px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl focus:outline-none"
            >
              <option value="All Payments">All Payments</option>
              <option value="Salaries">Salaries Only</option>
              <option value="Bonuses">Bonuses Only</option>
            </select>

            <button 
              id="btn-time-weeks"
              onClick={() => setTimeframe('Weeks')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                timeframe === 'Weeks' 
                  ? 'bg-neutral-900 border-neutral-950 text-white' 
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200'
              }`}
            >
              Weeks
            </button>

            <button 
              id="btn-time-year"
              onClick={() => setTimeframe('This Year')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                timeframe === 'This Year' 
                  ? 'bg-neutral-900 border-neutral-950 text-white' 
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200'
              }`}
            >
              This Year
            </button>
          </div>
        </div>

        {/* CUSTOM DECORATIVE LEGEND CONTAINER */}
        <div className="flex items-center gap-4 mb-4 text-xs font-sans font-medium text-neutral-500" id="chart-legends">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span>Consulting & Advisory Incomes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" />
            <span>Payroll & Supplier Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0 border-b-2 border-dashed border-rose-300 inline-block" />
            <span>Expense Budget Cap (Trend)</span>
          </div>
        </div>

        {/* SVG PLOTTING VIEWPORT */}
        <div className="relative pt-2" id="svg-view-container">
          <svg 
            id="svg-chart-element"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            className="w-full h-44 overflow-visible"
          >
            {/* Grids / Vertical Bar highlights */}
            {points.map((p, idx) => (
              <g key={idx}>
                <line 
                  x1={p.x} 
                  y1={padding} 
                  x2={p.x} 
                  y2={chartHeight - padding} 
                  stroke="#f1f5f9" 
                  strokeWidth="1" 
                  strokeDasharray="3,3"
                />
                
                <rect 
                  x={p.x - 20} 
                  y={0} 
                  width={40} 
                  height={chartHeight} 
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPointIndex(idx)}
                />
              </g>
            ))}

            {/* Income Curve (Emerald Green) */}
            <path 
              d={incomePath} 
              fill="none" 
              className="text-emerald-550 fill-none" 
              stroke="#10b981" 
              strokeWidth="2.5" 
            />

            {/* Expense Curve (Purple-violet Accent) */}
            <path 
              d={expensePath} 
              fill="none" 
              stroke="#7C3AED" 
              strokeWidth="2.5" 
            />

            <line 
              x1={points[0].x}
              y1={points[0].expenseY + 15}
              x2={points[points.length-1].x}
              y2={points[points.length-1].expenseY - 10}
              stroke="#f43f5e"
              strokeWidth="1"
              strokeDasharray="4,4"
            />

            {/* Data Dots */}
            {points.map((p, idx) => {
              const isHovered = hoveredPointIndex === idx;
              return (
                <g key={idx}>
                  <circle 
                    cx={p.x} 
                    cy={p.incomeY} 
                    r={isHovered ? 5 : 2.5} 
                    fill="#10b981" 
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2 : 1}
                  />

                  <circle 
                    cx={p.x} 
                    cy={p.expenseY} 
                    r={isHovered ? 5 : 2.5} 
                    fill="#7C3AED" 
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2 : 1}
                  />
                  
                  <text 
                    x={p.x} 
                    y={chartHeight - 12} 
                    textAnchor="middle" 
                    className="text-[10px] font-mono fill-neutral-400 font-bold"
                  >
                    {p.month}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HOVER TOOLTIP FLOATER */}
          {hoveredPointIndex !== null && points[hoveredPointIndex] && (
            <div 
              className="absolute pointer-events-none bg-neutral-900 text-white rounded-lg px-3.5 py-2.5 text-[11px] shadow-sm flex flex-col gap-1 transition-all duration-155 z-20 font-sans border border-neutral-700 min-w-[155px]"
              style={{
                left: `${(points[hoveredPointIndex].x / chartWidth) * 100}%`,
                top: `${(points[hoveredPointIndex].expenseY / chartHeight) * 100 - 35}%`,
                transform: 'translateX(-50%)',
              }}
              id="active-chart-tooltip"
            >
              <div className="font-bold text-neutral-400 border-b border-neutral-800 pb-1 flex items-center justify-between">
                <span>Monthly Audits</span>
                <span className="text-[9px] px-1 bg-emerald-950 text-emerald-400 rounded">Balanced</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-neutral-400 uppercase font-semibold text-[8px] tracking-wider">Revenue:</span>
                <span className="text-emerald-400 font-bold font-mono">₦{points[hoveredPointIndex].income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 uppercase font-semibold text-[8px] tracking-wider">Payroll Disbursed:</span>
                <span className="text-purple-400 font-bold font-mono">₦{points[hoveredPointIndex].expense.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-t border-neutral-800 mt-1 pt-1">
                <span className="text-neutral-300 font-semibold text-[9px]">Net Flow:</span>
                <span className="text-white font-bold font-mono">₦{points[hoveredPointIndex].net.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
