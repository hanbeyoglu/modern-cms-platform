import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { useMallRequired } from '../hooks/useMallRequired';
import { MallStoreCategoriesSection } from '../components/MallStoreCategoriesSection';
import { LocationScopedModuleShell } from '../components/location-scoped/LocationScopedModuleShell';

export function StoreCategoriesPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const { canAny } = usePermission();
  const [search, setSearch] = useState('');

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';

  const canManage = canAny(
    'location:update',
    'store-category:create',
    'store-category:update',
    'store-category:delete',
  );

  return (
    <LocationScopedModuleShell
      title="Mağaza Kategorileri"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Ada veya slug…',
      }}
    >
      {accessToken && tenantId && mallId ? (
        <MallStoreCategoriesSection
          accessToken={accessToken}
          tenantId={tenantId}
          mallId={mallId}
          canEdit={canManage}
          search={search.trim() || undefined}
          showScopeHint={false}
        />
      ) : null}
    </LocationScopedModuleShell>
  );
}
