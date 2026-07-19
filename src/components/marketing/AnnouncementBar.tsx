import React from 'react';
import { X, Sparkles } from 'lucide-react';

export function AnnouncementBar() {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-[#082F49] via-[#0C4A6E] to-[#0EA5E9] text-white text-center text-xs sm:text-sm py-2.5 px-4">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles size={14} className="text-yellow-300" />
        <span className="font-medium">New:</span>
        {' '}AI-powered invoice scanning &mdash; upload any receipt, we&rsquo;ll extract the data automatically.{' '}
        <a href="#features" className="underline font-semibold hover:text-yellow-200 transition-colors">Learn more</a>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
