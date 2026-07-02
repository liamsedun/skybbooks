import { useQuery } from '@tanstack/react-query';
import { notificationsApi, NotificationItem } from '../lib/api';
import { useAuth } from './useAuth';

export function useNotifications() {
  const { token } = useAuth();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!token,
  });

  return {
    notifications: (query.data || []) as NotificationItem[],
    unreadCount: (query.data || []).filter(n => n.severity === 'error' || n.severity === 'warning').length,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
