import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { useMallRequired } from '../hooks/useMallRequired';
import { MallLocationLanguagesSection } from '../components/MallLocationLanguagesSection';
import { LocationScopedModuleShell } from '../components/location-scoped/LocationScopedModuleShell';

export function LanguagesPage() {
  const { accessToken, malls, activeMallId } = useAuth();
  const mallCtx = useMallRequired();
  const { can } = usePermission();

  const selectedMall = malls.find((m) => m.id === activeMallId);
  const tenantId =
    mallCtx.status === 'ready'
      ? (selectedMall?.tenantId ?? mallCtx.tenantId)
      : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';
  const canEdit = can('location:update');

  return (
    <LocationScopedModuleShell
      title="Diller"
      noSelectionDescription="Dil yönetimi lokasyon kapsamlıdır; üstten bir lokasyon seçin. Son seçiminiz otomatik hatırlanır."
    >
      {accessToken && tenantId && mallId ? (
        <MallLocationLanguagesSection
          accessToken={accessToken}
          tenantId={tenantId}
          locationId={mallId}
          canEdit={canEdit}
          showScopeHint={false}
        />
      ) : null}
    </LocationScopedModuleShell>
  );
}
