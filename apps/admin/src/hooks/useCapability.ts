import { useAuth } from '../auth/useAuth';

export function useCapability() {
  const { user, activeTenantId } = useAuth();

  function has(code: string): boolean {
    if (!user) return false;
    // Super admins see everything
    if (user.isSuperAdmin) return true;

    const membership = activeTenantId
      ? user.memberships?.find((m) => m.tenantId === activeTenantId)
      : null;
    if (!membership) return false;

    const caps = membership.capabilities;
    if (!Array.isArray(caps)) return true; // legacy sessions — open until refreshed
    return caps.includes(code);
  }

  return { has };
}
