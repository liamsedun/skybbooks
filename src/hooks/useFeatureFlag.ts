import { useState, useEffect } from 'react';
import { featureFlagApi } from '../lib/api';

export interface FeatureFlagState {
  code: string;
  name: string;
  state: 'enabled' | 'disabled' | 'limited' | 'unlimited';
  usageLimit: number;
  source: string;
}

export function useFeatureFlag(code: string): FeatureFlagState | null {
  const [flag, setFlag] = useState<FeatureFlagState | null>(null);

  useEffect(() => {
    featureFlagApi.evaluate(code).then(setFlag).catch(() => setFlag(null));
  }, [code]);

  return flag;
}

export function useFeatureFlags(): FeatureFlagState[] {
  const [flags, setFlags] = useState<FeatureFlagState[]>([]);

  useEffect(() => {
    featureFlagApi.evaluateAll().then(setFlags).catch(() => setFlags([]));
  }, []);

  return flags;
}

export function isFeatureEnabled(flag: FeatureFlagState | null): boolean {
  if (!flag) return false;
  return flag.state === 'enabled' || flag.state === 'unlimited';
}

export function isFeatureLimited(flag: FeatureFlagState | null): boolean {
  if (!flag) return false;
  return flag.state === 'limited';
}
