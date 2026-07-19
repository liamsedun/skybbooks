import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { ArrowRight } from 'lucide-react';

const gradients = [
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-violet-400 to-purple-600',
];

interface BlogPost {
  tag: string;
  tagColor: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  gradient: string;
}

const posts: BlogPost[] = [
  {
    tag: 'Tax Tips',
    tagColor: 'text-amber-700 bg-amber-50',
    title: 'Understanding the New VAT Guidelines for 2026',
    excerpt: 'The Federal Inland Revenue Service has released updated VAT guidelines for 2026. Here is everything your business needs to know to stay compliant.',
    author: 'Chioma Okafor',
    date: 'Mar 15, 2026',
    gradient: gradients[0],
  },
  {
    tag: 'Product Updates',
    tagColor: 'text-emerald-700 bg-emerald-50',
    title: '5 Ways to Automate Your Accounts Payable',
    excerpt: 'Manual accounts payable is costing your business time and money. Discover five powerful automation strategies you can implement today.',
    author: 'Emeka Nwosu',
    date: 'Mar 8, 2026',
    gradient: gradients[1],
  },
  {
    tag: 'Industry Insights',
    tagColor: 'text-purple-700 bg-purple-50',
    title: 'How to Prepare Your Business for FIRS Tax Audit',
    excerpt: 'A FIRS tax audit does not have to be stressful. Learn how proper record-keeping and SkyBooks reporting can make the process seamless.',
    author: 'Sarah Adeyemi',
    date: 'Feb 28, 2026',
    gradient: gradients[2],
  },
];

export function BlogPreview() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div className="max-w-xl">
            <span className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-widest">Blog</span>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-[#082F49]">
              Latest from the SkyBooks blog
            </h2>
          </div>
          <a
            href="#"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[#0EA5E9] hover:text-[#082F49] transition-colors shrink-0"
          >
            View all articles
            <ArrowRight size={14} />
          </a>
        </div>

        <div ref={ref} className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {posts.map((post, i) => (
            <div
              key={post.title}
              className={`micro-lift group bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className={`h-44 bg-gradient-to-br ${post.gradient} flex items-center justify-center`}>
                <span className="text-white/20 text-6xl font-bold">{post.tag.charAt(0)}</span>
              </div>
              <div className="p-6">
                <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full mb-3 ${post.tagColor}`}>
                  {post.tag}
                </span>
                <h3 className="text-base font-semibold text-[#082F49] mb-2 group-hover:text-[#0EA5E9] transition-colors line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-5 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-600">{post.author}</span>
                  <span className="text-xs text-slate-400">{post.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0EA5E9] hover:text-[#082F49] transition-colors"
          >
            View all articles
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
