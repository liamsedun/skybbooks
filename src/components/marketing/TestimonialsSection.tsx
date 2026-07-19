import React, { useState, useEffect, useCallback } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

interface Testimonial {
  name: string;
  company: string;
  industry: string;
  quote: string;
  rating: number;
  initials: string;
  color: string;
}

const industries = [
  'Business Owners', 'Accountants', 'Retailers', 'Manufacturers',
  'Consultants', 'Service Companies', 'Importers', 'Distributors',
  'Agriculture', 'Healthcare', 'Education',
];

const testimonials: Testimonial[] = [
  { name: 'Chioma Okafor', company: 'Lagos Tech Hub', industry: 'Business Owners', rating: 5, color: '#0EA5E9', initials: 'CO',
    quote: 'SkyBooks transformed how we manage our finances. The automated bank reconciliation alone saves us 15 hours every month. The IFRS-compliant reports make tax season stress-free.' },
  { name: 'Emeka Nwosu', company: 'Prime Distributors Ltd', industry: 'Distributors', rating: 5, color: '#8B5CF6', initials: 'EN',
    quote: 'We switched from QuickBooks to SkyBooks because of the Nigerian tax engine. Automated VAT and WHT computations are a game-changer. Our accountant loves it.' },
  { name: 'Sarah Adeyemi', company: 'Westlink Enterprises', industry: 'Importers', rating: 5, color: '#059669', initials: 'SA',
    quote: 'The multi-currency support and CBN rate integration make cross-border transactions seamless. Finally, an accounting platform built for African businesses.' },
  { name: 'Tunde Balogun', company: 'Balogun & Co.', industry: 'Accountants', rating: 5, color: '#D97706', initials: 'TB',
    quote: 'I recommend SkyBooks to all my clients. The audit trail, role-based access, and automated VAT/WHT filings save us weeks of manual work during tax season.' },
  { name: 'Funmi Adegoke', company: 'Adegoke Ventures', industry: 'Retailers', rating: 4, color: '#DC2626', initials: 'FA',
    quote: 'Managing inventory across three stores was a nightmare until SkyBooks. Now I track stock, sales, and profit margins in real time from my phone.' },
  { name: 'Yakubu Suleiman', company: 'Northern Agro Ltd', industry: 'Agriculture', rating: 5, color: '#16A34A', initials: 'YS',
    quote: 'SkyBooks understands the realities of agricultural businesses. From seasonal cash flow tracking to government grant reconciliation, it fits our needs perfectly.' },
  { name: 'Amara Obi', company: 'Obi Manufacturing Co.', industry: 'Manufacturers', rating: 5, color: '#2563EB', initials: 'AO',
    quote: 'Production costing and inventory valuation used to take days. SkyBooks gives us real-time COGS and margin analysis. The IFRS compliance is a bonus for our auditors.' },
  { name: 'Kunle Martins', company: 'Martins Consulting', industry: 'Consultants', rating: 4, color: '#7C3AED', initials: 'KM',
    quote: 'As a consultant, I bill in multiple currencies and need clean project profitability reports. SkyBooks handles both effortlessly. The AI-powered categorization is spookily accurate.' },
  { name: 'Bisi Ogunlesi', company: 'Bisi Ogunlesi & Partners', industry: 'Service Companies', rating: 5, color: '#0891B2', initials: 'BO',
    quote: 'Recurring billing and expense tracking for our firm is now fully automated. The bank feed feature matches transactions in real time. No more data entry.' },
  { name: 'Chuka Eze', company: 'Eze Healthcare Ltd', industry: 'Healthcare', rating: 4, color: '#E11D48', initials: 'CE',
    quote: 'Running a private hospital comes with complex payroll and inventory. SkyBooks handles staff salaries, NHIS deductions, and medical supply tracking effortlessly.' },
  { name: 'Ngozi Okpara', company: 'Gracehill Academy', industry: 'Education', rating: 5, color: '#CA8A04', initials: 'NO',
    quote: 'From tuition fee management to staff payroll and PTA fund tracking, SkyBooks gives our school complete financial visibility. The parents love the automated receipt system.' },
];

const ratingColors = ['#F59E0B', '#F59E0B', '#F59E0B', '#F59E0B', '#F59E0B'];

export function TestimonialsSection() {
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  const filtered = filter
    ? testimonials.filter(t => t.industry === filter)
    : testimonials;
  const current = filtered[Math.min(active, filtered.length - 1)];

  const goTo = useCallback((idx: number) => {
    setDirection(idx > active ? 'right' : 'left');
    setActive(idx);
  }, [active]);

  const next = useCallback(() => {
    setDirection('right');
    setActive(prev => (prev + 1) % filtered.length);
  }, [filtered.length]);

  const prev = useCallback(() => {
    setDirection('left');
    setActive(prev => (prev - 1 + filtered.length) % filtered.length);
  }, [filtered.length]);

  // auto-rotate
  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  // reset active when filter changes
  useEffect(() => {
    setActive(0);
  }, [filter]);

  const renderStars = (n: number) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} className={i < n ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
      ))}
    </div>
  );

  return (
    <section id="testimonials" className="py-16 lg:py-24 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Testimonials</span>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
            Trusted by businesses across Nigeria
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            From retail to healthcare, see why companies choose SkyBooks.
          </p>
        </div>

        {/* Industry filter pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setFilter(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === null
                ? 'bg-[#082F49] text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0EA5E9]/40 hover:text-[#082F49]'
            }`}
          >
            All
          </button>
          {industries.map(ind => (
            <button
              key={ind}
              onClick={() => setFilter(ind)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                filter === ind
                  ? 'bg-[#082F49] text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0EA5E9]/40 hover:text-[#082F49]'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>

        {/* Carousel */}
        {current && (
          <div className="relative max-w-3xl mx-auto">
            {/* Nav arrows */}
            <button onClick={prev} aria-label="Previous testimonial" className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-12 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:border-slate-300 hover:shadow-md transition-all text-slate-400 hover:text-[#082F49]">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button onClick={next} aria-label="Next testimonial" className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-12 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:border-slate-300 hover:shadow-md transition-all text-slate-400 hover:text-[#082F49]">
              <ChevronRight size={16} aria-hidden="true" />
            </button>

            {/* Card */}
            <div
              key={current.name + (filter || '')}
              className="bg-white rounded-2xl border border-slate-200 p-8 lg:p-10 shadow-sm animate-slide-in"
            >
              <div className="flex flex-col sm:flex-row items-start gap-6">
                {/* Avatar */}
                <div className="shrink-0">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${current.color}, ${current.color}dd)` }}
                  >
                    {current.initials}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-[#082F49]">{current.name}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">{current.company}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-xs font-medium text-[#0EA5E9]">{current.industry}</span>
                    {renderStars(current.rating)}
                  </div>
                  <Quote size={18} className="text-[#0EA5E9]/20 mb-1" />
                  <p className="text-sm text-slate-600 leading-relaxed">&ldquo;{current.quote}&rdquo;</p>
                </div>
              </div>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-1.5 mt-5">
              {filtered.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === active ? 'w-6 bg-[#082F49]' : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
