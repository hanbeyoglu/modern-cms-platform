import type { ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { useCapability } from '../hooks/useCapability';
import { ForbiddenPage } from '../pages/ForbiddenPage';

type Props = {
  children: ReactNode;
  /** Required permission code — if absent the check is skipped. */
  permission?: string;
  /** User must hold at least one of these permissions (OR). */
  anyPermission?: string[];
  /** Required capability code — checked unless user is Super Admin. */
  capability?: string;
  /** Only Super Admins may access this page. */
  superAdminOnly?: boolean;
};

export function PermissionGate({
  children,
  permission,
  anyPermission,
  capability,
  superAdminOnly,
}: Props) {
  const { user } = useAuth();
  const { can, canAny } = usePermission();
  const { has } = useCapability();

  if (superAdminOnly && !user?.isSuperAdmin) return <ForbiddenPage />;
  if (permission && !can(permission)) return <ForbiddenPage />;
  if (anyPermission && anyPermission.length > 0 && !canAny(...anyPermission)) return <ForbiddenPage />;
  if (capability && !user?.isSuperAdmin && !has(capability)) return <ForbiddenPage />;

  return <>{children}</>;
}
