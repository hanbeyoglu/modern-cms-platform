import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { Button } from './ui/Button';
import { LoadingState } from './ui/LoadingState';
import { CreateSliderGroupModal } from './CreateSliderGroupModal';
import { LinkSliderGroupsModal } from './LinkSliderGroupsModal';
import {
  apiSliderUpdate,
  apiSlidersList,
  type Slider,
  type SliderStatus,
} from '../lib/api';
import { formatChannels } from '../lib/content-channels';
import {
  getLinkedSliderEntityConfig,
  type LinkedSliderEntityKind,
} from '../lib/linked-slider-entities';
import { usePermission } from '../hooks/usePermission';

const STATUS_STYLE: Record<SliderStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv' },
};

function StatusBadge({ status }: { status: SliderStatus }) {
  const c = STATUS_STYLE[status];
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

type Props = {
  entityType: LinkedSliderEntityKind;
  entityId: string;
  mallId?: string;
};

export function LinkedSliderGroupsSection({ entityType, entityId, mallId }: Props) {
  const config = getLinkedSliderEntityConfig(entityType);
  const navigate = useNavigate();
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();
  const canRead = can('slider:read');
  const canUpdate = can('slider:update');
  const canCreate = can('slider:create');

  const [linked, setLinked] = useState<Slider[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadLinked = useCallback(async () => {
    if (!accessToken || !activeTenantId || !canRead) return;
    setLoading(true);
    try {
      const data = await apiSlidersList(accessToken, activeTenantId, {
        mallId,
        placementType: config.placementType,
        linkedEntityType: config.kind,
        linkedEntityId: entityId,
        limit: 100,
      });
      setLinked(data.sliders);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : config.loadError);
      setLinked([]);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    activeTenantId,
    entityId,
    mallId,
    canRead,
    config.placementType,
    config.kind,
    config.loadError,
  ]);

  useEffect(() => {
    void loadLinked();
  }, [loadLinked]);

  const handleUnlink = async (sliderId: string) => {
    if (!accessToken || !activeTenantId || !canUpdate) return;
    if (!window.confirm(config.unlinkConfirm)) return;
    setUnlinkingId(sliderId);
    try {
      await apiSliderUpdate(accessToken, activeTenantId, sliderId, {
        placementType: 'CUSTOM',
        linkedEntityType: null,
        linkedEntityId: null,
      });
      toast.success('Bağlantı kaldırıldı');
      void loadLinked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bağlantı kaldırılamadı');
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleCreated = (slider: Slider) => {
    toast.success('Slider grubu oluşturuldu');
    void loadLinked();
    navigate(`/sliders/${slider.id}`);
  };

  if (!canRead) {
    return (
      <section style={sectionStyle}>
        <h4 style={headingStyle}>{config.sectionTitle}</h4>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Slider görüntüleme yetkiniz yok.</p>
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <h4 style={headingStyle}>{config.sectionTitle}</h4>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{config.sectionDescription}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canUpdate && (
            <Button variant="secondary" size="sm" onClick={() => setLinkModalOpen(true)}>
              Slider Grubu Bağla
            </Button>
          )}
          {canCreate && (
            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
              Yeni Slider Grubu Oluştur
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Slider grupları yükleniyor…" />
      ) : linked.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{config.emptyMessage}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {linked.map((s) => (
            <div key={s.id} style={cardStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14 }}>{s.title}</strong>
                  <StatusBadge status={s.status} />
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  {formatChannels(s.channels)} · {s._count?.items ?? s.items?.length ?? 0} slayt
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                <Link
                  to={`/sliders/${s.id}`}
                  style={{ fontSize: 13, color: '#2563eb', alignSelf: 'center' }}
                >
                  Düzenle
                </Link>
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unlinkingId === s.id}
                    onClick={() => void handleUnlink(s.id)}
                  >
                    {unlinkingId === s.id ? 'Kaldırılıyor…' : 'Bağlantıyı kaldır'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LinkSliderGroupsModal
        open={linkModalOpen}
        entityType={entityType}
        entityId={entityId}
        mallId={mallId}
        linkedSliderIds={linked.map((s) => s.id)}
        onClose={() => setLinkModalOpen(false)}
        onLinked={() => void loadLinked()}
      />

      <CreateSliderGroupModal
        open={createModalOpen}
        canCreate={canCreate}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
        preset={{
          placementType: config.placementType,
          linkedEntityId: entityId,
          lockPlacement: true,
        }}
      />
    </section>
  );
}

const sectionStyle: CSSProperties = {
  gridColumn: '1 / -1',
  marginTop: 8,
  paddingTop: 16,
  borderTop: '1px solid #e5e7eb',
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: '#111827',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
};
