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

    const codes = membership.permissions;
    if (Array.isArray(codes)) {
      return codes.includes(permission);
    }

    // Eski oturumlarda permissions yoksa sınırlı bir okuma listesi (geri uyumluluk)
    const readPermissions = [
      'media:read',
      'slider:read',
      'event:read',
      'campaign:read',
      'store-category:read',
      'global-store:read',
      'mall-store:read',
      'cinema:read',
      'movie:read',
      'movie-session:read',
      'page:read',
      'page-block:read',
      'analytics:view',
      'locale:read',
      'translation:read',
    ];
    if (readPermissions.includes(permission)) return true;

    return false;
  }

  return { can };
}
