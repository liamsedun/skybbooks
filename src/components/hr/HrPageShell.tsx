import { ReactNode } from 'react';
import { HelpPanel } from './HelpPanel';
import { RelatedModules } from './RelatedModules';
import { getPageConfig, RelatedModule } from '../../lib/hrPageConfig';

interface HrPageShellProps {
  title: string;
  description: string;
  children: ReactNode;
  headerActions?: ReactNode;
  pageKey?: string;
  helpContent?: ReactNode;
  relatedModules?: RelatedModule[];
}

export function HrPageShell({ title, description, children, headerActions, pageKey, helpContent, relatedModules }: HrPageShellProps) {
  const config = pageKey ? getPageConfig(pageKey) : undefined;
  const resolvedHelp = helpContent ?? (config ? <p className="text-xs text-ink-600 dark:text-ink-400 leading-relaxed">{config.helpContent}</p> : undefined);
  const resolvedModules = relatedModules ?? config?.relatedModules;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{title}</h1>
          <p className="text-sm text-ink-400 mt-0.5">{description}</p>
        </div>
        {headerActions && (
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
          </div>
        )}
      </div>
      {resolvedHelp && <HelpPanel>{resolvedHelp}</HelpPanel>}
      {resolvedModules && resolvedModules.length > 0 && <RelatedModules modules={resolvedModules} />}
      {children}
    </div>
  );
}
