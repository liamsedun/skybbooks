import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Search, Mail, Phone, MapPin, DollarSign,
  ExternalLink, UserCheck, AlertCircle, Loader2
} from 'lucide-react';
import { api } from '../../lib/api';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function CrmContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: contactsRes, isLoading } = useQuery({
    queryKey: ['crm-contacts'],
    queryFn: async () => {
      const r = await api.get('/sales/customers');
      return r.data.data as any[];
    },
  });
  const contacts = contactsRes || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900">CRM Contacts</h1>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input type="text" placeholder="Search by name, email, city..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-12 text-center">
          <Users className="w-10 h-10 mx-auto text-ink-300 mb-3" />
          <p className="text-sm font-medium text-ink-500">No contacts found</p>
          <p className="text-xs text-ink-400 mt-1">Import your customers to start tracking deals.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-custom">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Email</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Phone</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">City</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Balance</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any, i: number) => (
                  <tr key={c.id} className={`border-b border-border-custom/50 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {c.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-xs font-semibold text-ink-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.email ? (
                        <span className="text-xs text-ink-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-ink-400 shrink-0" />{c.email}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone ? (
                        <span className="text-xs text-ink-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-ink-400 shrink-0" />{c.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.city ? (
                        <span className="text-xs text-ink-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-ink-400 shrink-0" />{c.city}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-ink-700">{fmtNaira(c.balance || 0)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium flex items-center gap-1 w-fit ${c.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        <UserCheck className="w-3 h-3" />
                        {c.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/app/crm/deals?contactId=${c.id}`)}
                        className="flex items-center gap-1 ml-auto text-[10px] font-medium text-primary hover:text-primary-hover px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> View Deals
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
