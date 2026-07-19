import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  Shield, ShieldCheck, Cloud, Users, ScrollText, Globe, CheckCircle,
  FileText, Receipt, Building2, Activity, Lock, Database, RefreshCw, Server,
} from 'lucide-react';

const items = [
  { label: '256-bit Encryption', icon: Shield, color: '#0EA5E9', group: 'Security' },
  { label: 'SSL Security', icon: Lock, color: '#0EA5E9', group: 'Security' },
  { label: '99.9% Uptime', icon: Activity, color: '#0EA5E9', group: 'Security' },
  { label: 'Role Permissions', icon: Users, color: '#0EA5E9', group: 'Security' },
  { label: 'Cloud Backup', icon: Cloud, color: '#8B5CF6', group: 'Backup' },
  { label: 'Daily Backups', icon: RefreshCw, color: '#8B5CF6', group: 'Backup' },
  { label: 'Audit Trail', icon: ScrollText, color: '#8B5CF6', group: 'Backup' },
  { label: 'GDPR Ready', icon: Globe, color: '#059669', group: 'Compliance' },
  { label: 'NDPR Ready', icon: CheckCircle, color: '#059669', group: 'Compliance' },
  { label: 'IFRS Compliant', icon: FileText, color: '#059669', group: 'Compliance' },
  { label: 'VAT Ready', icon: Receipt, color: '#059669', group: 'Compliance' },
  { label: 'FIRS Ready', icon: Building2, color: '#059669', group: 'Compliance' },
  { label: 'Database Encryption', icon: Database, color: '#0EA5E9', group: 'Security' },
  { label: 'SOC 2 Infrastructure', icon: ShieldCheck, color: '#059669', group: 'Compliance' },
];

const groups = ['Security', 'Backup', 'Compliance'] as const;
const groupLabels: Record<string, string> = {
  Security: 'Security & Infrastructure',
  Backup: 'Backup & Audit',
  Compliance: 'Regulatory Compliance',
};

export function Security() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="security" className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Security & Trust</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Bank-grade security for your financial data
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Your data is protected by enterprise-grade encryption, daily backups, and full regulatory compliance.
          </p>
        </div>

        <div ref={ref} className="space-y-10">
          {groups.map((group, gIdx) => {
            const groupItems = items.filter(i => i.group === group);
            return (
              <div key={group} className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                style={{ transitionDelay: `${gIdx * 150}ms` }}
              >
                <h3 className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest mb-4">{groupLabels[group]}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {groupItems.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="group relative flex flex-col items-center justify-center gap-2.5 bg-white rounded-xl border border-slate-200 p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 cursor-default"
                      >
                        <div className="transition-all duration-300 group-hover:scale-110" style={{ color: item.color }}>
                          <Icon size={24} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">{item.label}</span>
                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                          style={{ boxShadow: `inset 0 0 24px ${item.color}12` }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust bar */}
        <div className={`mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 transition-all duration-700 delay-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <span className="flex items-center gap-1"><Shield size={12} className="text-emerald-500" /> AES-256 at rest</span>
          <span className="text-slate-200">·</span>
          <span className="flex items-center gap-1"><Lock size={12} className="text-emerald-500" /> TLS 1.3 in transit</span>
          <span className="text-slate-200">·</span>
          <span className="flex items-center gap-1"><Server size={12} className="text-emerald-500" /> 30-day retention</span>
          <span className="text-slate-200">·</span>
          <span className="flex items-center gap-1"><Globe size={12} className="text-emerald-500" /> Geo-redundant</span>
        </div>
      </div>
    </section>
  );
}
