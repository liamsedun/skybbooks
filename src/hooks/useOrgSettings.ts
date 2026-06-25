import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '../lib/api';
import { useCallback } from 'react';

export function useOrgSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['orgSettings'],
    queryFn: orgApi.getSettings,
  });

  const mutation = useMutation({
    mutationFn: (partial: Record<string, any>) => orgApi.updateSettings(partial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgSettings'] });
    },
  });

  const save = useCallback((partial: Record<string, any>, options?: { onSuccess?: () => void; onError?: (err: any) => void }) => {
    mutation.mutate(partial, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['orgSettings'] });
        options?.onSuccess?.();
      },
      onError: options?.onError,
    });
  }, [mutation, queryClient]);

  return { settings: settings || {}, isLoading, save, isPending: mutation.isPending, error: mutation.error };
}
