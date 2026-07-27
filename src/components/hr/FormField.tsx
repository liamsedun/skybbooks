import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface FieldWrapperProps {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  helperText?: string;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ label, name, error, required, helperText, children, className }: FieldWrapperProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <label htmlFor={fieldId} className="block text-xs font-semibold text-ink-600 dark:text-ink-400 uppercase tracking-wider">
        {label}
        {required && <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        {children}
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-rose-500 mt-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="text-xs text-ink-400 mt-0.5">{helperText}</p>
      )}
    </div>
  );
}

const baseInputStyle = 'w-full px-3 py-2.5 text-sm border rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-ink-50 dark:disabled:bg-ink-800/50';
const errorInputStyle = 'border-rose-300 dark:border-rose-700 focus:ring-rose-20 focus:border-rose-400';

function inputBorder(error?: string) {
  return error ? errorInputStyle : 'border-border-custom';
}

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export function FormInput({ label, name, value, onChange, error, required, helperText, type = 'text', placeholder, disabled, className, ...rest }: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <FieldWrapper label={label} name={name} error={error} required={required} helperText={helperText} className={className}>
      <input
        id={name}
        name={name}
        type={inputType}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`${baseInputStyle} ${inputBorder(error)} ${isPassword ? 'pr-10' : ''}`}
        {...rest}
      />
      {isPassword && (
        <button type="button" onClick={() => setShowPassword(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </FieldWrapper>
  );
}

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export function FormSelect({ label, name, value, onChange, options, placeholder, error, required, helperText, disabled, className, ...rest }: FormSelectProps) {
  return (
    <FieldWrapper label={label} name={name} error={error} required={required} helperText={helperText} className={className}>
      <select
        id={name}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        className={`${baseInputStyle} ${inputBorder(error)} appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3d%220%200%2020%2020%22%20fill%3d%22%2394a3b8%22%3e%3cpath%20fill-rule%3d%22evenodd%22%20d%3d%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3d%22evenodd%22%2f%3e%3c%2fsvg%3e')] bg-[length:20px] bg-[right_10px_center] bg-no-repeat pr-9 cursor-pointer`}
        {...rest}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldWrapper>
  );
}

interface FormTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export function FormTextarea({ label, name, value, onChange, error, required, helperText, placeholder, disabled, rows = 3, className, ...rest }: FormTextareaProps) {
  return (
    <FieldWrapper label={label} name={name} error={error} required={required} helperText={helperText} className={className}>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        aria-invalid={!!error}
        className={`${baseInputStyle} ${inputBorder(error)} resize-y min-h-[60px]`}
        {...rest}
      />
    </FieldWrapper>
  );
}

interface FormDatePickerProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  helperText?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

export function FormDatePicker({ label, name, value, onChange, error, required, helperText, disabled, min, max, className }: FormDatePickerProps) {
  return (
    <FieldWrapper label={label} name={name} error={error} required={required} helperText={helperText} className={className}>
      <input
        id={name}
        name={name}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        aria-invalid={!!error}
        className={`${baseInputStyle} ${inputBorder(error)}`}
      />
    </FieldWrapper>
  );
}

interface FormSwitchProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  helperText?: string;
  className?: string;
}

export function FormSwitch({ label, name, checked, onChange, disabled, helperText, className }: FormSwitchProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className || ''}`}>
      <div className="space-y-0.5">
        <label htmlFor={name} className="text-sm font-medium text-ink-900 cursor-pointer">{label}</label>
        {helperText && <p className="text-xs text-ink-400">{helperText}</p>}
      </div>
      <button
        id={name}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-primary' : 'bg-ink-200 dark:bg-ink-700'}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

interface FormFileUploadProps {
  label: string;
  name: string;
  onChange: (file: File | null) => void;
  error?: string;
  required?: boolean;
  helperText?: string;
  accept?: string;
  disabled?: boolean;
  className?: string;
  fileName?: string;
}

export function FormFileUpload({ label, name, onChange, error, required, helperText, accept = '.csv', disabled, className, fileName }: FormFileUploadProps) {
  const fieldId = useId();
  return (
    <FieldWrapper label={label} name={name} error={error} required={required} helperText={helperText} className={className}>
      <label htmlFor={fieldId}
        className={`flex flex-col items-center justify-center w-full py-4 px-3 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:bg-ink-50 dark:hover:bg-ink-800/50 ${error ? 'border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/20' : 'border-border-custom'}`}>
        <div className="text-center">
          <p className="text-xs font-medium text-ink-600">{fileName || 'Click to upload'}</p>
          <p className="text-[10px] text-ink-400 mt-0.5">{accept.split(',').join(', ')} files accepted</p>
        </div>
        <input id={fieldId} name={name} type="file" accept={accept} disabled={disabled}
          onChange={e => onChange(e.target.files?.[0] || null)}
          className="sr-only" aria-invalid={!!error} />
      </label>
    </FieldWrapper>
  );
}

interface FormCheckboxProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function FormCheckbox({ label, name, checked, onChange, disabled, error, className }: FormCheckboxProps) {
  return (
    <div className={className || ''}>
      <label htmlFor={name} className="flex items-center gap-2.5 cursor-pointer group">
        <input
          id={name}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 rounded border-ink-300 text-primary focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-sm text-ink-700 group-hover:text-ink-900 transition-colors">{label}</span>
      </label>
      {error && <p role="alert" className="flex items-center gap-1 text-xs text-rose-500 mt-1 ml-6"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

interface RadioOption { label: string; value: string; }

interface FormRadioGroupProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormRadioGroup({ label, name, value, onChange, options, error, required, disabled, className }: FormRadioGroupProps) {
  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <p className="text-xs font-semibold text-ink-600 dark:text-ink-400 uppercase tracking-wider">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </p>
      <div className="flex flex-wrap gap-3">
        {options.map(o => (
          <label key={o.value} className={`flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer transition-colors text-sm ${value === o.value ? 'border-primary bg-primary/5 text-primary' : 'border-border-custom text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800/50'}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={e => onChange(e.target.value)}
              disabled={disabled}
              className="sr-only"
            />
            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${value === o.value ? 'border-primary' : 'border-ink-300'}`}>
              {value === o.value && <span className="w-2 h-2 rounded-full bg-primary" />}
            </span>
            {o.label}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="flex items-center gap-1 text-xs text-rose-500 mt-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}
