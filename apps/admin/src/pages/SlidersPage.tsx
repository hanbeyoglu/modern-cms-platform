import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { IconArchive, IconPencil, IconTrash } from '../components/ui/icons';
import { CreateSliderGroupModal } from '../components/CreateSliderGroupModal';
import {
  apiSliderArchive,
  apiSliderDelete,
  apiSliderPublish,
  apiSlidersList,
  type Slider,
  type SliderPlacementType,
  type SliderStatus,
  API_MAX_PAGE_SIZE,
} from '../lib/api';
import { usePermission } from '../hooks/usePermission';

const STATUS_COLORS: Record<SliderStatus, { bg: string; color: string; label: string; dot: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak', dot: '#9ca3af' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış', dot: '#f59e0b' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında', dot: '#10b981' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşivlendi', dot: '#9ca3af' },
};

const PLACEMENT_LABELS: Record<SliderPlacementType, string> = {
  HOME: 'Ana Sayfa',
  CAMPAIGN: 'Kampanya',
  EVENT: 'Etkinlik',
  STORE: 'Mağaza',
  LOCATION: 'Konum',
  CUSTOM: 'Özel',
};

function StatusBadge({ status }: { status: SliderStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span className="cms-status-badge" style={{ background: c.bg, color: c.color }}>
      <span className="cms-status-badge__dot" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

type ConfirmState =
  | { kind: 'delete'; id: string; title: string }
  | { kind: 'archive'; id: string; title: string };

export function SlidersPage() {
  const { accessToken, activeTenantId, activeMallId, mallsLoading } = useAuth();
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('slider:create');
  const canUpdate = can('slider:update');
  const canPublish = can('slider:publish');
  const canDelete = can('slider:delete');

  const [sliders, setSliders] = useState<Slider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiSlidersList(accessToken, activeTenantId, {
        mallId: activeMallId ?? undefined,
        limit: API_MAX_PAGE_SIZE,
      });
      setSliders(data.sliders);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Slider listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, activeMallId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = (slider: Slider) => {
    toast.success('Slider grubu oluşturuldu');
    void load();
    navigate(`/sliders/${slider.id}`);
  };

  const handlePublish = async (id: string) => {
    if (!accessToken || !activeTenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      await apiSliderPublish(accessToken, activeTenantId, id);
      toast.success('Yayınlandı');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlanamadı');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleArchive = async (id: string) => {
    if (!accessToken || !activeTenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      await apiSliderArchive(accessToken, activeTenantId, id);
      toast.success('Arşivlendi');
      setConfirm(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arşivlenemedi');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !activeTenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      await apiSliderDelete(accessToken, activeTenantId, id);
      toast.success('Silindi');
      setConfirm(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Slider Grupları"
        subtitle="Her grup birden fazla slayt içerebilir. Slaytları düzenlemek için gruba tıklayın."
        action={
          canCreate ? (
            <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
              Yeni Slider Grubu
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => void load()} />}

      {mallsLoading ? (
        <LoadingState label="AVM bilgileri yükleniyor…" />
      ) : loading ? (
        <LoadingState label="Slider grupları yükleniyor…" />
      ) : !activeTenantId ? (
        <EmptyState
          title="Tenant seçilmedi"
          description="Slider yönetimi için üst menüden bir tenant seçin."
        />
      ) : sliders.length === 0 ? (
        <EmptyState
          title="Henüz slider grubu yok"
          description="Yeni bir slider grubu oluşturup içine slaytlar ekleyin."
          action={
            canCreate ? (
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                İlk slider grubunu oluştur
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="cms-data-table-wrap">
          <table className="cms-data-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Yerleşim</th>
                <th>Slayt</th>
                <th>Durum</th>
                <th>Sıra</th>
                <th style={{ textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {sliders.map((s) => {
                const busy = actionBusyId === s.id;
                return (
                <tr key={s.id}>
                  <td>
                    <Link to={`/sliders/${s.id}`} style={{ color: '#2563eb', fontWeight: 600 }}>
                      {s.title}
                    </Link>
                  </td>
                  <td>{PLACEMENT_LABELS[s.placementType]}</td>
                  <td>{s._count?.items ?? s.items?.length ?? 0}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>{s.sortOrder}</td>
                  <td>
                    <div className="cms-data-table__actions">
                      <Button variant="secondary" size="sm" disabled={busy} onClick={() => navigate(`/sliders/${s.id}`)}>
                        <IconPencil />
                        Düzenle
                      </Button>
                      {canPublish && (s.status === 'DRAFT' || s.status === 'SCHEDULED') && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handlePublish(s.id)}>
                          Yayınla
                        </Button>
                      )}
                      {canUpdate && s.status === 'PUBLISHED' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: 'archive', id: s.id, title: s.title })}
                        >
                          <IconArchive />
                          Arşivle
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="dangerSoft"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: 'delete', id: s.id, title: s.title })}
                        >
                          <IconTrash />
                          Sil
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'delete' ? 'Slider grubunu sil' : 'Slider grubunu arşivle'}
        description={
          confirm?.kind === 'delete'
            ? `"${confirm.title}" slider grubunu silmek istediğinizden emin misiniz?`
            : `"${confirm?.title ?? ''}" slider grubunu arşivlemek istediğinizden emin misiniz?`
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Sil' : 'Arşivle'}
        variant={confirm?.kind === 'delete' ? 'danger' : 'default'}
        confirming={Boolean(confirm && actionBusyId === confirm.id)}
        onCancel={() => {
          if (!actionBusyId) setConfirm(null);
        }}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === 'delete') void handleDelete(confirm.id);
          else void handleArchive(confirm.id);
        }}
      />

      <CreateSliderGroupModal
        open={createModalOpen}
        canCreate={canCreate}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />
    </PageContainer>
  );
}

