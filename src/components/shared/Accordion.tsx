import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  children: ReactNode;
  className?: string;
  type?: 'single' | 'multiple';
  defaultValue?: string[];
}

export function Accordion({ children, className, type = 'single', defaultValue = [] }: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(defaultValue);

  const toggle = (value: string) => {
    if (type === 'single') {
      setOpenItems(prev => prev.includes(value) ? [] : [value]);
    } else {
      setOpenItems(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    }
  };

  return (
    <div className={`divide-y divide-border-custom border border-border-custom rounded-xl ${className || ''}`}>
      {React.Children.map(children, child => {
        if (React.isValidElement<AccordionItemProps>(child)) {
          return React.cloneElement(child, {
            _open: openItems.includes(child.props.value),
            _onToggle: () => toggle(child.props.value),
          });
        }
        return child;
      })}
    </div>
  );
}

interface AccordionItemProps {
  value: string;
  title: string;
  children: ReactNode;
  _open?: boolean;
  _onToggle?: () => void;
  disabled?: boolean;
}

export function AccordionItem({ value, title, children, _open, _onToggle, disabled }: AccordionItemProps) {
  const isOpen = _open || false;
  return (
    <div>
      <button
        type="button"
        onClick={_onToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
        role="region"
        aria-hidden={!isOpen}
      >
        <div className="px-4 pb-3 text-sm text-ink-600">{children}</div>
      </div>
    </div>
  );
}
