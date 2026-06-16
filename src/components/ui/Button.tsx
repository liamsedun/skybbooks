import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, type = 'button', ...props }, ref) => {
    return (
      <button
        type={type}
        disabled={disabled || isLoading}
        ref={ref}
        className={twMerge(
          clsx(
            // Base layout/styles with 8px border-radius (rounded-lg) and focus rings
            'inline-flex items-center justify-center font-sans font-semibold rounded-lg text-xs transition duration-200 outline-none select-none cursor-pointer',
            'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:opacity-50 disabled:pointer-events-none',
            
            // Variants
            {
              // Primary Accent
              'bg-primary hover:bg-primary-hover text-white shadow-xs focus-visible:ring-primary': variant === 'primary',
              
              // Secondary Card / Slate outline
              'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs focus-visible:ring-slate-400': variant === 'secondary',
              
              // Ghost Button
              'bg-transparent hover:bg-slate-50 text-slate-600 focus-visible:ring-slate-400': variant === 'ghost',
            },
            
            // Heights strictly between 36px and 40px (md is 38px)
            {
              'h-[32px] px-3 text-[11px]': size === 'sm',
              'h-[38px] px-4': size === 'md',
              'h-[42px] px-5': size === 'lg',
            }
          ),
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
