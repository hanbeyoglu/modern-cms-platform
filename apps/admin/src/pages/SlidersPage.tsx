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

const STATUS_COLORS: Record<SliderStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşivlendi' },
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
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 4,
        background: c.bg,
        color: c.color,
      }}
    >
      {c.label}
    </span>
  );
}

export function SlidersPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
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
    if (!accessToken || !activeTenantId) return;
    try {
      await apiSliderPublish(accessToken, activeTenantId, id);
      toast.success('Yayınlandı');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlanamadı');
    }
  };

  const handleArchive = async (id: string) => {
    if (!accessToken || !activeTenantId) return;
    try {
      await apiSliderArchive(accessToken, activeTenantId, id);
      toast.success('Arşivlendi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arşivlenemedi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !activeTenantId) return;
    if (!window.confirm('Bu slider grubunu silmek istediğinize emin misiniz?')) return;
    try {
      await apiSliderDelete(accessToken, activeTenantId, id);
      toast.success('Silindi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
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

      {loading ? (
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
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Başlık</th>
                <th style={thStyle}>Yerleşim</th>
                <th style={thStyle}>Slayt</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}>Sıra</th>
                <th style={{ ...thStyle, width: 200 }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {sliders.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>
                    <Link to={`/sliders/${s.id}`} style={{ color: '#2563eb', fontWeight: 600 }}>
                      {s.title}
                    </Link>
                  </td>
                  <td style={tdStyle}>{PLACEMENT_LABELS[s.placementType]}</td>
                  <td style={tdStyle}>{s._count?.items ?? s.items?.length ?? 0}</td>
                  <td style={tdStyle}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={tdStyle}>{s.sortOrder}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/sliders/${s.id}`)}>
                        Düzenle
                      </Button>
                      {canPublish && s.status !== 'PUBLISHED' && (
                        <Button variant="ghost" size="sm" onClick={() => void handlePublish(s.id)}>
                          Yayınla
                        </Button>
                      )}
                      {canUpdate && s.status === 'PUBLISHED' && (
                        <Button variant="ghost" size="sm" onClick={() => void handleArchive(s.id)}>
                          Arşivle
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => void handleDelete(s.id)}>
                          Sil
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateSliderGroupModal
        open={createModalOpen}
        canCreate={canCreate}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />
    </PageContainer>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: 12,
  color: '#6b7280',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};
