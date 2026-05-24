import { useAuth } from '../auth/useAuth';
import type { MeMembership } from '../lib/api';

export function useActiveMembership(): MeMembership | null {
  const { user, activeTenantId } = useAuth();
  if (!user || !activeTenantId) return null;
  return user.memberships?.find((membership) => membership.tenantId === activeTenantId) ?? null;
}
