import { useAuth } from '../auth/useAuth';

export type MallRequiredStatus =
  | { status: 'no-tenant' }
  | { status: 'loading' }
  | { status: 'no-malls'; message: string }
  | { status: 'no-selection' }
  | { status: 'ready'; tenantId: string; mallId: string };

export function useMallRequired(): MallRequiredStatus {
  const { activeTenantId, activeMallId, malls, mallsLoading, mallsError } = useAuth();

  if (!activeTenantId) {
    return { status: 'no-tenant' };
  }

  if (mallsLoading) {
    return { status: 'loading' };
  }

  if (malls.length === 0) {
    return {
      status: 'no-malls',
      message: mallsError ?? 'Bu tenant için tanımlı AVM/lokasyon bulunamadı.',
    };
  }

  if (!activeMallId) {
    return { status: 'no-selection' };
  }

  return { status: 'ready', tenantId: activeTenantId, mallId: activeMallId };
}
