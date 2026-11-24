import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import {
  apiDemoContentApply,
  apiDemoContentBatch,
  apiDemoContentPreview,
  apiDemoContentRemove,
  apiMallContentReset,
  apiMallContentResetPreview,
  type DemoPreviewResponse,
  type MallResetPreview,
} from '../lib/api';
import { ConfirmDialog } from './ui/ConfirmDialog';

type Props = {
  mallId: string;
  mallName: string;
  tenantName?: string;
};

export function DemoContentPanel({ mallId, mallName, tenantName }: Props) {
  const { accessToken, activeTenantId, user } = useAuth();
  const { can } = usePermission();
  const canImport = can('demo:import');
  const canRemove = can('demo:remove');
  const canReset = user?.isSuperAdmin === true && can('mall:content-reset');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<DemoPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [shiftDates, setShiftDates] = useState(true);
  const [applying, setApplying] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPreview, setResetPreview] = useState<MallResetPreview | null>(null);
  const [resetConfirmName, setResetConfirmName] = useState('');
  const [resetConfirmAgain, setResetConfirmAgain] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadPreview = useCallback(
    async (nextShiftDates = shiftDates) => {
      if (!accessToken) return;
      setPreviewLoading(true);
      try {
        const data = await apiDemoContentPreview(
          accessToken,
          mallId,
          activeTenantId ?? undefined,
          { shiftDates: nextShiftDates },
        );
        setPreview(data);
        setPreviewOpen(true);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setPreviewLoading(false);
      }
    },
    [accessToken, activeTenantId, mallId, shiftDates],
  );

  useEffect(() => {
    if (!accessToken || !batchId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const batch = await apiDemoContentBatch(
          accessToken,
          mallId,
          batchId,
          activeTenantId ?? undefined,
        );
        if (cancelled) return;
        setBatchStatus(batch.status);
        if (batch.status === 'COMPLETED') {
          toast.success('Demo içerik yükleme tamamlandı');
          setBatchId(null);
          setApplying(false);
          setPreviewOpen(false);
        } else if (batch.status === 'FAILED') {
          toast.error(batch.errorMessage || 'Demo içerik yükleme başarısız');
          setBatchId(null);
          setApplying(false);
        }
      } catch (e) {
        if (!cancelled) toast.error((e as Error).message);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [accessToken, activeTenantId, batchId, mallId]);

  if (!canImport && !canRemove && !canReset) return null;

  const handleShiftToggle = (checked: boolean) => {
    setShiftDates(checked);
    if (previewOpen) void loadPreview(checked);
  };

  const handleApply = async () => {
    if (!accessToken) return;
    setApplying(true);
    try {
      const started = await apiDemoContentApply(
        accessToken,
        mallId,
        activeTenantId ?? undefined,
        { shiftDates },
      );
      setBatchId(started.batchId);
      setBatchStatus(started.status);
      toast.message('Demo içerik yükleme başlatıldı…');
    } catch (e) {
      toast.error((e as Error).message);
      setApplying(false);
    }
  };

  const handleRemove = async () => {
    if (!accessToken) return;
    setRemoving(true);
    try {
      const result = await apiDemoContentRemove(accessToken, mallId, activeTenantId ?? undefined);
      toast.success(
        `Demo veriler kaldırıldı (${Object.values(result.deleted).reduce((a, b) => a + b, 0)} kayıt)`,
      );
      setRemoveOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRemoving(false);
    }
  };

  const openReset = async () => {
    if (!accessToken) return;
    try {
      const data = await apiMallContentResetPreview(
        accessToken,
        mallId,
        activeTenantId ?? undefined,
      );
      setResetPreview(data);
      setResetConfirmName('');
      setResetConfirmAgain(false);
      setResetOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReset = async () => {
    if (!accessToken || !resetPreview) return;
    setResetting(true);
    try {
      await apiMallContentReset(
        accessToken,
        mallId,
        { confirmName: resetConfirmName.trim(), confirmAgain: resetConfirmAgain },
        activeTenantId ?? undefined,
      );
      toast.success('AVM içerikleri sıfırlandı');
      setResetOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      id="demo-content"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 20,
        marginTop: 20,
        background: '#fff',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>
        Demo İçerik
      </div>
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 14 }}>
        Hedef: <strong>{tenantName ? `${tenantName} / ` : ''}{mallName}</strong>. İşlem yalnızca bu
        lokasyona uygulanır; kayıtlar demo olarak işaretlenir.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {canImport && (
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={previewLoading || applying}
            style={btnPrimary}
          >
            {previewLoading ? 'Önizleme…' : 'Demo İçerik Yükle'}
          </button>
        )}
        {canRemove && (
          <button type="button" onClick={() => setRemoveOpen(true)} style={btnSecondary}>
            Demo Verilerini Kaldır
          </button>
        )}
        {canReset && (
          <button type="button" onClick={() => void openReset()} style={btnDanger}>
            AVM İçeriklerini Sıfırla
          </button>
        )}
      </div>
      {batchStatus && applying && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
          Batch durumu: {batchStatus}
        </div>
      )}

      {previewOpen && preview && (
        <div style={modalOverlay}>
          <div style={{ ...modalPanel, width: 720 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Demo İçerik Önizleme</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                Hedef AVM: <strong>{preview.targetMallName}</strong> ({preview.tenant.name} /{' '}
                {preview.mall.displayName ?? preview.mall.name})
              </div>
            </div>
            <div style={{ padding: 20, maxHeight: '65vh', overflowY: 'auto' }}>
              <label
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: 16,
                  fontSize: 13,
                  color: '#111827',
                }}
              >
                <input
                  type="checkbox"
                  checked={shiftDates}
                  disabled={previewLoading || applying}
                  onChange={(e) => handleShiftToggle(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <strong>Demo tarihlerini bugüne göre ayarla</strong>
                  <div style={{ color: '#6b7280', marginTop: 2 }}>
                    Açıkken kampanya/etkinlik süreleri korunarak kaydırılır; film seansları bugüne
                    yazılır. Kapalıyken kaynak tarihler korunur, geçmiş içerik taslak kalır.
                    {preview.shiftDates
                      ? ` (kaydırma: ${preview.dateShiftDays} gün)`
                      : ''}
                  </div>
                </span>
              </label>

              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                Kaynak sayıları
              </div>
              <CountGrid
                items={[
                  ['Mağaza', preview.counts.stores],
                  ['Kampanya', preview.counts.campaigns],
                  ['Etkinlik', preview.counts.events],
                  ['Film', preview.counts.movies],
                  ['Slider', preview.counts.sliders],
                  ['Benzersiz görsel', preview.counts.uniqueMediaUrls],
                ]}
              />

              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', margin: '16px 0 8px' }}>
                Public sitede görünür olacak (tahmini)
              </div>
              <CountGrid
                items={[
                  ['Kampanya', preview.publicVisibility.campaigns],
                  ['Etkinlik', preview.publicVisibility.events],
                  ['Film', preview.publicVisibility.movies],
                  ['Slider', preview.publicVisibility.sliders],
                ]}
              />

              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12 }}>
                Mevcut demo eşlemeleri: {preview.existingDemoMappings}. Süresi dolmuş → DRAFT:{' '}
                {preview.expiredAsDraft.length}. Yüklenecek görsel: {preview.media.wouldUpload}.
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#374151' }}>{preview.note}</div>

              {preview.textReplacements.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                    Metin değişimleri (Metrogarden → {preview.targetMallName})
                  </div>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      maxHeight: 180,
                      overflowY: 'auto',
                      fontSize: 12,
                    }}
                  >
                    {preview.textReplacements.slice(0, 20).map((row, idx) => (
                      <div
                        key={`${row.entityType}-${row.sourceKey}-${row.field}-${idx}`}
                        style={{
                          padding: '8px 10px',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        <div style={{ color: '#6b7280' }}>
                          {row.entityType}.{row.field}
                        </div>
                        <div style={{ color: '#b45309' }}>{row.before}</div>
                        <div style={{ color: '#047857' }}>→ {row.after}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!shiftDates && preview.expiredAsDraft.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#92400e' }}>
                  {preview.expiredAsDraft.length} kampanya/etkinlik süresi geçmiş; taslak olarak
                  oluşturulacak (kaynak tarihler korunuyor).
                </div>
              )}
              {preview.errors.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#991b1b' }}>
                  {preview.errors.slice(0, 5).join(' · ')}
                </div>
              )}
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} disabled={applying} onClick={() => setPreviewOpen(false)}>
                İptal
              </button>
              <button type="button" style={btnPrimary} disabled={applying || previewLoading} onClick={() => void handleApply()}>
                {applying ? 'Yükleniyor…' : 'İçeriği Yükle'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeOpen}
        title="Demo verilerini kaldır"
        description={`${tenantName ? `${tenantName} / ` : ''}${mallName} lokasyonundaki yalnızca demo batch kayıtları silinecek. Gerçek içeriklere ve paylaşılan medyaya dokunulmaz.`}
        variant="danger"
        confirmLabel="Demo Verilerini Kaldır"
        confirming={removing}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() => void handleRemove()}
      />

      {resetOpen && resetPreview && (
        <div style={modalOverlay}>
          <div style={{ ...modalPanel, border: '1px solid #fecaca' }}>
            <div style={{ padding: '16px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#991b1b' }}>AVM İçeriklerini Sıfırla</div>
              <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 4 }}>
                Yalnızca Super Admin. Tenant, kullanıcı, API key ve sistem ayarları korunur.
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <CountGrid
                items={Object.entries(resetPreview.counts).map(([k, v]) => [k, v])}
              />
              <label style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 600 }}>
                Onay için lokasyon adını yazın: <code>{resetPreview.confirmHint}</code>
              </label>
              <input
                value={resetConfirmName}
                onChange={(e) => setResetConfirmName(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '8px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={resetConfirmAgain}
                  onChange={(e) => setResetConfirmAgain(e.target.checked)}
                />
                Bu işlemi onaylıyorum (ikinci onay)
              </label>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #fecaca', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} disabled={resetting} onClick={() => setResetOpen(false)}>
                İptal
              </button>
              <button
                type="button"
                style={btnDanger}
                disabled={
                  resetting ||
                  resetConfirmName.trim() !== resetPreview.confirmHint ||
                  !resetConfirmAgain
                }
                onClick={() => void handleReset()}
              >
                {resetting ? 'Sıfırlanıyor…' : 'Sıfırlamayı Uygula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CountGrid({ items }: { items: Array<[string, number]> }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 8,
      }}
    >
      {items.map(([label, value]) => (
        <div
          key={label}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '10px 12px',
            background: '#f9fafb',
          }}
        >
          <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

const btnPrimary: CSSProperties = {
  padding: '6px 14px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnSecondary: CSSProperties = {
  padding: '6px 14px',
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnDanger: CSSProperties = {
  padding: '6px 14px',
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const modalOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 90,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};
const modalPanel: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  width: 640,
  maxWidth: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
