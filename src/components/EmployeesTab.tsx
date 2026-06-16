/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Mail, 
  Search, 
  Calendar,
  Wrench
} from 'lucide-react';
import { Employee, Kobo } from '../types';

interface EmployeesTabProps {
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

/**
 * EmployeesTab Component
 * Coordinates personnel directories, handles new consultant registrations, and manages billing rates
 * in Nigerian kobo integers.
 */
export default function EmployeesTab({ employees, setEmployees }: EmployeesTabProps) {
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRate, setNewRate] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  /**
   * Registers a new consultant. Converts input Naira to kobo integers safely.
   */
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newRole || !newEmail || !newRate) return;

    const rateNumNaira = parseFloat(newRate);
    if (isNaN(rateNumNaira) || rateNumNaira <= 0) {
      alert("Please enter a valid hourly rate.");
      return;
    }

    const rateNumKobo = Math.round(rateNumNaira * 100);

    const avatars = [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100'
    ];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    const newEmp: Employee = {
      id: Math.floor(100000 + Math.random() * 900000).toString(),
      name: newName,
      role: newRole,
      avatar: randomAvatar,
      status: 'active',
      hourlyRate: rateNumKobo,
      email: newEmail,
      joinedDate: new Date().toISOString().split('T')[0]
    };

    setEmployees(prev => [...prev, newEmp]);
    
    // reset form
    setNewName('');
    setNewRole('');
    setNewEmail('');
    setNewRate('');
    setShowAddForm(false);
    
    alert(`Successfully registered ${newEmp.name} into Skyhouse Payroll Database.`);
  };

  const toggleStatus = (id: string) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id !== id) return emp;
      return { 
        ...emp, 
        status: emp.status === 'active' ? 'inactive' : 'active' 
      };
    }));
  };

  const deleteEmployee = (id: string) => {
    if (confirm("Are you sure you want to completely remove this employee record from Skyhouse systems? This is irreversible.")) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  /**
   * Prompts edit, converting inputs back to kobo integers safely.
   */
  const updateHourlyRate = (id: string, currentRateKobo: Kobo) => {
    const currentRateNaira = currentRateKobo / 100;
    const val = prompt(`Enter new hourly billing rate for this consultant (₦):`, currentRateNaira.toString());
    if (!val || isNaN(Number(val))) return;

    const newRateKobo = Math.round(parseFloat(val) * 100);

    setEmployees(prev => prev.map(emp => {
      if (emp.id !== id) return emp;
      return { ...emp, hourlyRate: newRateKobo };
    }));
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.role.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in" id="employees-tab-root">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="employees-header-row">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 font-sans">Employees & Consultants Directory</h2>
          <p className="text-xs text-neutral-500 font-sans">Manage personnel accounts, salaries, direct deposits, and operational roles for Skyhouse client accounts</p>
        </div>

        <div className="flex items-center gap-3 font-sans" id="employees-top-controls">
          <div className="relative w-full sm:w-64" id="roster-search-field-wrapper">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input 
              id="input-staff-lookup"
              type="text"
              placeholder="Search directory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 transition"
            />
          </div>

          <button 
            id="btn-toggle-add-staff"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Consultant
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE ADD FORM CARD */}
      {showAddForm && (
        <form onSubmit={handleAddEmployee} className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm space-y-4 font-sans" id="form-register-new-consultant">
          <h3 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-2">Register New Personnel</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="add-consultant-inputs">
            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Full Name</label>
              <input 
                id="input-new-staff-name"
                type="text" 
                required
                placeholder="e.g. Liam Sterling"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Role & Title</label>
              <input 
                id="input-new-staff-role"
                type="text" 
                required
                placeholder="e.g. Principal Auditor"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Email Address</label>
              <input 
                id="input-new-staff-email"
                type="email" 
                required
                placeholder="liam.sterling@skyhouse.acct"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Hourly Billing Rate (₦)</label>
              <input 
                id="input-new-staff-rate"
                type="number" 
                required
                min="100"
                placeholder="e.g. 7500"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-neutral-800 font-mono"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end border-t border-neutral-100 pt-3">
            <button 
              id="btn-cancel-consultant"
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              id="btn-submit-consultant"
              type="submit"
              className="px-4 py-2 bg-purple-650 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer animate-fade-in"
              style={{ backgroundColor: '#7C3AED' }}
            >
              Confirm Registration
            </button>
          </div>
        </form>
      )}

      {/* PERSONNEL DIRECTORY TABLE */}
      <div className="bg-white border border-neutral-150 rounded-2xl overflow-hidden shadow-xs font-sans" id="directory-table-card">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse" id="staff-table">
            <thead className="sticky top-0 z-10 bg-surface-subtle shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)]">
              <tr className="h-12 border-b border-neutral-150 text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono align-middle bg-surface-subtle">
                <th className="px-6 h-12 align-middle select-none text-left bg-surface-subtle">Consultant ID</th>
                <th className="px-6 h-12 align-middle bg-surface-subtle">Professional Details</th>
                <th className="px-6 h-12 align-middle bg-surface-subtle">Contact Email</th>
                <th className="px-6 h-12 align-middle font-mono text-right bg-surface-subtle">Hourly Rate</th>
                <th className="px-6 h-12 align-middle bg-surface-subtle">Joining Date</th>
                <th className="px-6 h-12 align-middle text-center bg-surface-subtle">Security Status</th>
                <th className="px-6 h-12 align-middle text-right bg-surface-subtle">System Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-[13px] font-sans text-neutral-700 font-medium">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="h-12 hover:bg-neutral-50/50 transition duration-150 align-middle group" id={`row-employee-${emp.id}`}>
                  <td className="px-6 h-12 align-middle font-mono text-neutral-400 font-semibold text-[13px]">{emp.id}</td>
                  
                  <td className="px-6 h-12 align-middle">
                    <div className="flex items-center gap-3">
                      <img 
                        referrerPolicy="no-referrer"
                        src={emp.avatar} 
                        alt={emp.name} 
                        className="h-8 w-8 rounded-full object-cover border border-white"
                      />
                      <div>
                        <div className="text-[13px] font-bold text-neutral-900 leading-tight">{emp.name}</div>
                        <div className="text-[10px] text-neutral-400 leading-none">{emp.role}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 h-12 align-middle text-[13px]">
                    <a href={`mailto:${emp.email}`} className="text-neutral-500 hover:text-primary flex items-center gap-1.5 transition">
                      <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      {emp.email}
                    </a>
                  </td>

                  <td className="px-6 h-12 align-middle font-mono font-bold text-neutral-900 text-right tabular-nums text-[13px]">
                    ₦{(emp.hourlyRate / 100).toLocaleString(undefined, {minimumFractionDigits: 2})}/hr
                  </td>

                  <td className="px-6 h-12 align-middle text-neutral-500 flex items-center gap-1.5 font-mono text-[13px] h-12">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    {emp.joinedDate}
                  </td>

                  <td className="px-6 h-12 align-middle text-center">
                    <button
                      id={`btn-toggle-status-${emp.id}`}
                      onClick={() => toggleStatus(emp.id)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-full transition cursor-pointer inline-block select-none ${
                        emp.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold' 
                          : 'bg-neutral-100 text-neutral-500 border border-neutral-200 font-bold'
                      }`}
                    >
                      {emp.status === 'active' ? '● Active' : '○ Inactive'}
                    </button>
                  </td>

                  <td className="px-6 h-12 align-middle text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button 
                        id={`btn-change-rate-${emp.id}`}
                        onClick={() => updateHourlyRate(emp.id, emp.hourlyRate)}
                        className="p-1.5 border border-neutral-150 rounded-lg hover:bg-neutral-50 text-neutral-500 cursor-pointer"
                        title="Update Wage rate"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        id={`btn-delete-emp-${emp.id}`}
                        onClick={() => deleteEmployee(emp.id)}
                        className="p-1.5 border border-neutral-150 rounded-lg hover:bg-red-50 text-red-500 hover:border-red-100 cursor-pointer"
                        title="Deregister system profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs text-neutral-400 font-sans">
                    No matching personnel found in this directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
