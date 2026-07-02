import { useAuth } from '../auth/useAuth';

export function usePermission() {
  const { user, activeTenantId } = useAuth();

  function can(permission: string): boolean {
    if (!user) return false;
    if (user.isSuperAdmin) return true;

    const membership = activeTenantId
      ? user.memberships?.find((m) => m.tenantId === activeTenantId)
      : null;

    if (!membership) return false;

    const codes = membership.permissions;
    if (!Array.isArray(codes)) return false;
    return codes.includes(permission);
  }

  function canAny(...permissions: string[]): boolean {
    return permissions.some((p) => can(p));
  }

  return { can, canAny };
}
