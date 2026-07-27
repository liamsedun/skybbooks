import { useState, useCallback } from 'react';

export type ValidationRule = {
  required?: boolean | string;
  min?: number | string;
  max?: number | string;
  minLength?: number | string;
  maxLength?: number | string;
  pattern?: RegExp | string;
  email?: boolean | string;
  match?: string | { field: string; label: string };
  custom?: (value: any, values: Record<string, any>) => string | null;
};

export type ValidationConfig<T extends Record<string, any>> = {
  [K in keyof T]?: ValidationRule;
};

export type ValidationErrors = Record<string, string>;

function getVal(obj: Record<string, any>, key: string): any {
  const parts = key.split('.');
  let val = obj;
  for (const p of parts) {
    if (val == null || typeof val !== 'object') return '';
    val = val[p];
  }
  return val ?? '';
}

function runRule(value: any, rule: ValidationRule | undefined, values: Record<string, any>, fieldKey: string): string | null {
  if (!rule) return null;

  const str = String(value ?? '').trim();

  if (rule.required) {
    const msg = typeof rule.required === 'string' ? rule.required : `${fieldKey} is required`;
    if (!str) return msg;
  }

  if (rule.email) {
    const msg = typeof rule.email === 'string' ? rule.email : 'Invalid email address';
    if (str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return msg;
  }

  const num = Number(value);
  if (rule.min != null && !isNaN(num)) {
    const minVal = Number(rule.min);
    const msg = typeof rule.min === 'string' ? rule.min : `Minimum value is ${minVal}`;
    if (num < minVal) return msg;
  }

  if (rule.max != null && !isNaN(num)) {
    const maxVal = Number(rule.max);
    const msg = typeof rule.max === 'string' ? rule.max : `Maximum value is ${maxVal}`;
    if (num > maxVal) return msg;
  }

  if (rule.minLength != null) {
    const minLen = Number(rule.minLength);
    const msg = typeof rule.minLength === 'string' ? rule.minLength : `Minimum ${minLen} characters`;
    if (str.length < minLen) return msg;
  }

  if (rule.maxLength != null) {
    const maxLen = Number(rule.maxLength);
    const msg = typeof rule.maxLength === 'string' ? rule.maxLength : `Maximum ${maxLen} characters`;
    if (str.length > maxLen) return msg;
  }

  if (rule.pattern) {
    const regex = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
    const msg = typeof rule.pattern === 'string' ? rule.pattern : 'Invalid format';
    if (str && !regex.test(str)) return msg;
  }

  if (rule.match) {
    const target = typeof rule.match === 'string' ? rule.match : rule.match.field;
    const label = typeof rule.match === 'string' ? target : rule.match.label;
    const msg = `Must match ${label}`;
    if (str !== String(getVal(values, target) ?? '')) return msg;
  }

  if (rule.custom) {
    return rule.custom(value, values);
  }

  return null;
}

export function useFormValidation<T extends Record<string, any>>(config: ValidationConfig<T>) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback((field: keyof T, values: T): string | null => {
    return runRule(values[field as string], config[field], values, String(field));
  }, [config]);

  const validate = useCallback((values: T): boolean => {
    const newErrors: ValidationErrors = {};
    let valid = true;
    for (const key of Object.keys(config)) {
      const error = runRule(values[key], config[key], values, key);
      if (error) {
        newErrors[key] = error;
        valid = false;
      }
    }
    setErrors(newErrors);
    return valid;
  }, [config]);

  const validateAll = useCallback((values: T): boolean => {
    return validate(values);
  }, [validate]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const markTouched = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const getFieldError = useCallback((field: keyof T): string | undefined => {
    return errors[field as string];
  }, [errors]);

  return {
    errors,
    touched,
    validate,
    validateAll,
    validateField,
    clearErrors,
    clearFieldError,
    setFieldError,
    markTouched,
    getFieldError,
    setErrors,
  };
}

export function buildValidationErrors(error: any): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'An unexpected error occurred';
}

export const commonRules = {
  required: (label?: string): ValidationRule => ({ required: true, custom: undefined }),
  email: (): ValidationRule => ({ email: true }),
  phone: (): ValidationRule => ({ pattern: /^[\d\s\+\-\(\)]{7,20}$/, custom: undefined }),
  url: (): ValidationRule => ({ pattern: /^https?:\/\/.+/ }),
  positiveNumber: (): ValidationRule => ({ min: 1 }),
};
