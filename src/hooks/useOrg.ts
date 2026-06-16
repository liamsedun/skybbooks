/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '../lib/api';
import { useAuth } from './useAuth';

export function useOrg() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const orgQuery = useQuery({
    queryKey: ['organisation'],
    queryFn: orgApi.getOrg,
    staleTime: 60 * 1000,
    enabled: !!token,
  });

  const usersQuery = useQuery({
    queryKey: ['orgUsers'],
    queryFn: orgApi.getUsers,
    staleTime: 60 * 1000,
    enabled: !!token,
  });

  const updateOrgMutation = useMutation({
    mutationFn: orgApi.updateOrg,
    onSuccess: (updatedOrg) => {
      queryClient.setQueryData(['organisation'], updatedOrg);
      localStorage.setItem('organisation', JSON.stringify(updatedOrg));
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: orgApi.inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgUsers'] });
    },
  });

  return {
    organisation: orgQuery.data,
    isLoadingOrg: orgQuery.isLoading,
    orgError: orgQuery.error,
    users: usersQuery.data || [],
    isLoadingUsers: usersQuery.isLoading,
    updateOrganisation: updateOrgMutation.mutateAsync,
    isUpdatingOrg: updateOrgMutation.isPending,
    inviteUser: inviteUserMutation.mutateAsync,
    isInvitingUser: inviteUserMutation.isPending,
  };
}
