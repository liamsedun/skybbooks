import { useQuery } from '@tanstack/react-query';
import { platformApi } from '../lib/api';

export function usePlatformBranding() {
  const query = useQuery({
    queryKey: ['platformBranding'],
    queryFn: platformApi.getBranding,
    staleTime: 5 * 60 * 1000,
  });
  return {
    developerLogoUrl: query.data?.developerLogoUrl ?? null,
    isLoadingBranding: query.isLoading,
  };
}
