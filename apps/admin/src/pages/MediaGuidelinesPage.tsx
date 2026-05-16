import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { usePermission } from '../hooks/usePermission';
import {
  apiMediaGuidelineUpdate,
  apiMediaGuidelinesList,
  type MediaGuideline,
  type UpdateMediaGuidelinePayload,
} from '../lib/api/media-guidelines';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 4,
};

type EditForm = {
  recommendedWidth: string;
  recommendedHeight: string;
  acceptedMimeTypes: string;
  helperText: string;
  aspectRatioLocked: boolean;
  active: boolean;
};

function toForm(row: MediaGuideline): EditForm {
  return {
    recommendedWidth: String(row.recommendedWidth),
    recommendedHeight: String(row.recommendedHeight),
    acceptedMimeTypes: row.acceptedMimeTypes.join(', '),
    helperText: row.helperText ?? '',
    aspectRatioLocked: row.aspectRatioLocked,
    active: row.active,
  };
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MediaGuidelinesPage() {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();
  const canEdit = can('media:update');

  const [items, setItems] = useState<MediaGuideline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MediaGuideline | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiMediaGuidelinesList(accessToken, activeTenantId);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ayarlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(row: MediaGuideline) {
    setEditing(row);
    setForm(toForm(row));
  }

  async function handleSave() {
    if (!accessToken || !activeTenantId || !editing || !form) return;
    const width = Number.parseInt(form.recommendedWidth, 10);
    const height = Number.parseInt(form.recommendedHeight, 10);
    if (!width || !height) {
      toast.error('Genişlik ve yükseklik geçerli sayılar olmalıdır.');
      return;
    }
    const mimeTypes = form.acceptedMimeTypes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (mimeTypes.length === 0) {
      toast.error('En az bir MIME türü girin.');
      return;
    }

    const body: UpdateMediaGuidelinePayload = {
      recommendedWidth: width,
      recommendedHeight: height,
      acceptedMimeTypes: mimeTypes,
      helperText: form.helperText.trim() || null,
      aspectRatioLocked: form.aspectRatioLocked,
      active: form.active,
    };

    setSaving(true);
    try {
      await apiMediaGuidelineUpdate(accessToken, activeTenantId, editing.usageKey, body);
      toast.success('Medya boyut ayarı kaydedildi');
      setEditing(null);
      setForm(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Medya Boyut Ayarları"
        subtitle="Her kullanım alanı için önerilen görsel boyutlarını tenant bazında yapılandırın."
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingState label="Ayarlar yükleniyor…" />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Kullanım Alanı</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Önerilen Boyut</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Aspect Ratio</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Mime Types</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Aktif/Pasif</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.usageKey} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{row.usageKey}</div>
                      {row.helperText && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{row.helperText}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {row.recommendedWidth}×{row.recommendedHeight}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{row.aspectRatio}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#4b5563' }}>
                      {row.acceptedMimeTypes.join(', ')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge variant={row.active ? 'green' : 'gray'}>
                        {row.active ? 'Aktif' : 'Pasif'}
                      </Badge>
                      {row.source === 'default' && (
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Varsayılan</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {canEdit && (
                        <Button variant="secondary" onClick={() => openEdit(row)}>
                          Düzenle
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {editing && form && (
        <ModalOverlay onClose={() => { setEditing(null); setForm(null); }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{editing.label}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{editing.usageKey}</div>
            </div>

            <div style={{ padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={labelStyle}>
                  Genişlik (px)
                  <input
                    type="number"
                    min={1}
                    value={form.recommendedWidth}
                    onChange={(e) => setForm({ ...form, recommendedWidth: e.target.value })}
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Yükseklik (px)
                  <input
                    type="number"
                    min={1}
                    value={form.recommendedHeight}
                    onChange={(e) => setForm({ ...form, recommendedHeight: e.target.value })}
                    style={inputStyle}
                  />
                </label>
              </div>

              <label style={labelStyle}>
                Yardımcı metin
                <input
                  type="text"
                  value={form.helperText}
                  onChange={(e) => setForm({ ...form, helperText: e.target.value })}
                  style={inputStyle}
                  placeholder="Editör için kısa açıklama"
                />
              </label>

              <label style={labelStyle}>
                Kabul edilen MIME türleri (virgülle)
                <input
                  type="text"
                  value={form.acceptedMimeTypes}
                  onChange={(e) => setForm({ ...form, acceptedMimeTypes: e.target.value })}
                  style={inputStyle}
                  placeholder="image/*, image/png"
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.aspectRatioLocked}
                  onChange={(e) => setForm({ ...form, aspectRatioLocked: e.target.checked })}
                />
                En-boy oranını kilitle
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Aktif
              </label>
            </div>

            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <Button variant="secondary" onClick={() => { setEditing(null); setForm(null); }}>
                İptal
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </PageContainer>
  );
}
