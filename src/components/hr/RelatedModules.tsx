import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface RelatedModule {
  label: string;
  path: string;
  icon: ReactNode;
}

interface RelatedModulesProps {
  modules: RelatedModule[];
}

export function RelatedModules({ modules }: RelatedModulesProps) {
  if (modules.length === 0) return null;
  return (
    <div className="bg-surface rounded-2xl border border-border-custom p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">Related Modules</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {modules.map((m, i) => (
          <Link
            key={i}
            to={m.path}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border-custom hover:bg-ink-50 dark:hover:bg-ink-800/50 hover:border-primary/30 transition-all group"
          >
            <span className="text-ink-400 group-hover:text-primary transition-colors">{m.icon}</span>
            <span className="text-xs font-medium text-ink-600 group-hover:text-ink-900 transition-colors flex-1">{m.label}</span>
            <ArrowRight className="w-3 h-3 text-ink-300 group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
