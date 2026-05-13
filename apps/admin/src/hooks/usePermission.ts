import { useAuth } from '../auth/useAuth';

export function usePermission() {
  const { user, activeTenantId } = useAuth();

  function can(permission: string): boolean {
    if (!user) return false;
    if (user.isSuperAdmin) return true;

    // Find the membership for the active tenant
    const membership = activeTenantId
      ? user.memberships?.find((m) => m.tenantId === activeTenantId)
      : null;

    if (!membership) return false;

    // Role-based check: admin roles get full access within tenant
    const adminRoles = ['admin', 'superadmin', 'manager'];
    if (adminRoles.includes(membership.role.code.toLowerCase())) return true;

    // Future: granular permission map per role
    // For now, authenticated tenant members can view; non-admin roles denied write actions
    const readPermissions = [
      'media:list',
      'sliders:list',
      'events:list',
      'campaigns:list',
      'stores:list',
      'cinema:read',
      'movie:read',
      'movie-session:read',
    ];
    if (readPermissions.includes(permission)) return true;

    return false;
  }

  return { can };
}
