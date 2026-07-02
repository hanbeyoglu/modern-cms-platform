import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { useMallRequired } from '../hooks/useMallRequired';
import { MallFloorsSection } from '../components/MallFloorsSection';
import { LocationScopedModuleShell } from '../components/location-scoped/LocationScopedModuleShell';
import { Button } from '../components/ui/Button';

export function FloorsPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const { canAny } = usePermission();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';
  const canEdit = canAny('location:update', 'mall-store:update');

  return (
    <LocationScopedModuleShell
      title="Katlar"
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Kod veya etiket…',
      }}
      headerAction={
        canEdit ? (
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + Kat Ekle
          </Button>
        ) : undefined
      }
    >
      {accessToken && tenantId && mallId ? (
        <MallFloorsSection
          accessToken={accessToken}
          tenantId={tenantId}
          mallId={mallId}
          canEdit={canEdit}
          search={search.trim() || undefined}
          showScopeHint={false}
          formOpen={formOpen}
          onFormOpenChange={setFormOpen}
        />
      ) : null}
    </LocationScopedModuleShell>
  );
}
