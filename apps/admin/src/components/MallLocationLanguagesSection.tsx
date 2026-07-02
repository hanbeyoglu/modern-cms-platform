import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  apiLocationLocalesList,
  apiLocationLocalesUpdate,
  type LocationLocaleRow,
} from '../lib/api/location-locales';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { ErrorBanner } from './ui/ErrorBanner';
import { LoadingState } from './ui/LoadingState';

type Props = {
  accessToken: string;
  tenantId: string;
  locationId: string;
  canEdit: boolean;
  showScopeHint?: boolean;
};

function localeActionError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const msg = e.message;
  if (msg.includes('en az bir dil')) return 'Lokasyonda en az bir dil aktif kalmalıdır.';
  if (msg.includes('Varsayılan sistem dili')) return 'Varsayılan sistem dili lokasyonda devre dışı bırakılamaz.';
  if (msg.includes('sistemde pasif')) return 'Sistemde pasif bir dil lokasyonda etkinleştirilemez.';
  return msg || fallback;
}

export function MallLocationLanguagesSection({
  accessToken,
  tenantId,
  locationId,
  canEdit,
  showScopeHint = true,
}: Props) {
  const [rows, setRows] = useState<LocationLocaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<{ id: string; action: 'activate' | 'deactivate' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLocationLocalesList(accessToken, tenantId, locationId);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diller yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const locationActiveCount = rows.filter((r) => r.locationActive).length;

  async function persistActivation(target: LocationLocaleRow, isActive: boolean) {
    const payload = rows.map((r) => ({
      localeId: r.id,
      isActive: r.id === target.id ? isActive : r.locationActive,
    }));
    const updated = await apiLocationLocalesUpdate(accessToken, tenantId, locationId, { locales: payload });
    setRows(updated);
  }

  async function handleActivate(loc: LocationLocaleRow) {
    setActing({ id: loc.id, action: 'activate' });
    try {
      await persistActivation(loc, true);
      toast.success(`${loc.code.toUpperCase()} lokasyonda aktif edildi`);
    } catch (e) {
      toast.error(localeActionError(e, 'Dil aktif edilemedi'));
    } finally {
      setActing(null);
    }
  }

  async function handleDeactivate(loc: LocationLocaleRow) {
    if (loc.isDefault) {
      toast.error('Varsayılan sistem dili lokasyonda devre dışı bırakılamaz.');
      return;
    }
    if (loc.locationActive && locationActiveCount <= 1) {
      toast.error('Lokasyonda en az bir dil aktif kalmalıdır.');
      return;
    }
    setActing({ id: loc.id, action: 'deactivate' });
    try {
      await persistActivation(loc, false);
      toast.success(`${loc.code.toUpperCase()} lokasyonda pasifleştirildi`);
    } catch (e) {
      toast.error(localeActionError(e, 'Dil pasifleştirilemedi'));
    } finally {
      setActing(null);
    }
  }

  if (loading) return <LoadingState label="Diller yükleniyor…" />;

  if (error) {
    return <ErrorBanner message={error} onDismiss={() => setError(null)} />;
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="Aktif sistem dili yok"
        description="Lokasyonda yönetilecek aktif sistem dili bulunmuyor. Sistem yöneticisi önce sistem dillerini yapılandırmalıdır."
      />
    );
  }

  return (
    <div>
      {showScopeHint ? (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280', maxWidth: 640 }}>
          Sistemde aktif olan diller listelenir. Bu ekranda yalnızca seçili lokasyon için hangi dillerin
          aktif olacağını yönetirsiniz. Pasif diller içerik formlarında ve public API&apos;de görünmez.
        </p>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Sıra</th>
              <th style={{ padding: 8 }}>Kod</th>
              <th style={{ padding: 8 }}>Ad</th>
              <th style={{ padding: 8 }}>Yerel ad</th>
              <th style={{ padding: 8 }}>RTL</th>
              <th style={{ padding: 8 }}>Lokasyon durumu</th>
              <th style={{ padding: 8 }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((loc) => {
              const locationOn = loc.locationActive;
              return (
                <tr key={loc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8, color: '#9ca3af' }}>{loc.sortOrder}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{loc.code.toUpperCase()}</td>
                  <td style={{ padding: 8 }}>{loc.name}</td>
                  <td style={{ padding: 8, color: '#6b7280' }}>{loc.nativeName}</td>
                  <td style={{ padding: 8 }}>{loc.rtl ? <Badge variant="blue">RTL</Badge> : '—'}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {locationOn ? <Badge variant="green">Aktif</Badge> : <Badge variant="gray">Pasif</Badge>}
                      {loc.isDefault ? <Badge variant="blue">Varsayılan</Badge> : null}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {loc.isDefault ? (
                        <Button size="sm" variant="secondary" disabled title="Varsayılan dil devre dışı bırakılamaz">
                          Varsayılan dil
                        </Button>
                      ) : (
                        <>
                          {!locationOn && canEdit ? (
                            <Button
                              size="sm"
                              variant="primary"
                              loading={acting?.id === loc.id && acting.action === 'activate'}
                              disabled={acting !== null}
                              onClick={() => void handleActivate(loc)}
                            >
                              Aktif Et
                            </Button>
                          ) : null}
                          {locationOn && canEdit ? (
                            <Button
                              size="sm"
                              variant="danger"
                              loading={acting?.id === loc.id && acting.action === 'deactivate'}
                              disabled={acting !== null || locationActiveCount <= 1}
                              title={
                                locationActiveCount <= 1
                                  ? 'Lokasyonda en az bir dil aktif kalmalıdır'
                                  : undefined
                              }
                              onClick={() => void handleDeactivate(loc)}
                            >
                              Pasifleştir
                            </Button>
                          ) : null}
                          {!canEdit ? <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span> : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
