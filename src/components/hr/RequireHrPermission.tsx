import { ReactNode } from 'react';
import { useHrPermissions } from '../../hooks/useHrPermissions';

interface Props {
  permission: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireHrPermission({ permission, children, fallback = null }: Props) {
  const { can } = useHrPermissions();

  if (can(permission)) return <>{children}</>;

  return <>{fallback}</>;
}
