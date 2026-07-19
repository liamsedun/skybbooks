import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Shield, Lock, Server, Eye, Check } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'End-to-End Encryption',
    description: 'All data encrypted with AES-256 at rest and TLS 1.3 in transit. Your financial information stays private and secure.',
  },
  {
    icon: Lock,
    title: 'SOC 2 Infrastructure',
    description: 'Cloud infrastructure audited annually against SOC 2 Type II standards for security, availability, and confidentiality.',
  },
  {
    icon: Server,
    title: 'Daily Automated Backups',
    description: 'Automated backups with 30-day retention policy. Geo-redundant storage ensures your data survives any disaster.',
  },
  {
    icon: Eye,
    title: 'Access Controls & Audit Trails',
    description: 'Role-based permissions with granular access levels. Every action is logged in an immutable audit trail.',
  },
];

const badges = [
  'ISO 27001',
  'SOC 2 Type II',
  'NDPR Compliant',
  'PCI DSS',
];

export function Security() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Security</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Bank-grade security for your financial data
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Your data is protected by enterprise-grade security infrastructure and best-in-class practices.
          </p>
        </div>

        <div ref={ref} className="grid lg:grid-cols-5 gap-10 items-start">
          <div className="lg:col-span-3 space-y-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`flex gap-5 p-5 rounded-xl transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                    <Icon size={22} className="text-[#0EA5E9]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#082F49] mb-1">{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={`lg:col-span-2 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield size={22} className="text-[#0EA5E9]" />
                <h3 className="text-lg font-bold text-[#082F49]">Certifications & Compliance</h3>
              </div>
              <div className="space-y-3">
                {badges.map((badge) => (
                  <div
                    key={badge}
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-slate-100 micro-scale"
                  >
                    <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center">
                      <Check size={14} className="text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-[#082F49]">{badge}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-5 leading-relaxed">
                Independently verified security certifications and compliance frameworks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
