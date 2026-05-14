import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { TranslationPanel } from '../components/TranslationPanel';
import { Button } from '../components/ui/Button';
import {
  apiMediaList,
  apiSliderArchive,
  apiSliderCreate,
  apiSliderDelete,
  apiSliderPublish,
  apiSlidersList,
  apiSliderUpdate,
  type CreateSliderPayload,
  type MediaAsset,
  type Slider,
  type SliderLinkType,
  type SliderStatus,
  type SliderTargetDevice,
} from '../lib/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<SliderStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşivlendi' },
};

const DEVICE_LABELS: Record<SliderTargetDevice, string> = {
  ALL: 'Tümü',
  DESKTOP: 'Masaüstü',
  MOBILE: 'Mobil',
};

const LINK_TYPE_LABELS: Record<SliderLinkType, string> = {
  NONE: 'Yok',
  EXTERNAL_URL: 'Dış URL',
  INTERNAL_PAGE: 'İç Sayfa',
  EVENT: 'Etkinlik',
  CAMPAIGN: 'Kampanya',
  STORE: 'Mağaza',
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

function DeviceBadge({ device }: { device: SliderTargetDevice }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 7px',
        borderRadius: 4,
        background: '#eff6ff',
        color: '#1d4ed8',
      }}
    >
      {DEVICE_LABELS[device]}
    </span>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

type FormState = {
  title: string;
  subtitle: string;
  description: string;
  desktopMediaId: string;
  mobileMediaId: string;
  videoMediaId: string;
  linkType: SliderLinkType;
  linkValue: string;
  buttonText: string;
  startAt: string;
  endAt: string;
  sortOrder: string;
  status: SliderStatus;
  targetDevice: SliderTargetDevice;
};

const EMPTY_FORM: FormState = {
  title: '',
  subtitle: '',
  description: '',
  desktopMediaId: '',
  mobileMediaId: '',
  videoMediaId: '',
  linkType: 'NONE',
  linkValue: '',
  buttonText: '',
  startAt: '',
  endAt: '',
  sortOrder: '0',
  status: 'DRAFT',
  targetDevice: 'ALL',
};

function sliderToForm(s: Slider): FormState {
  return {
    title: s.title,
    subtitle: s.subtitle ?? '',
    description: s.description ?? '',
    desktopMediaId: s.desktopMediaId ?? '',
    mobileMediaId: s.mobileMediaId ?? '',
    videoMediaId: s.videoMediaId ?? '',
    linkType: s.linkType,
    linkValue: s.linkValue ?? '',
    buttonText: s.buttonText ?? '',
    startAt: s.startAt ? s.startAt.slice(0, 16) : '',
    endAt: s.endAt ? s.endAt.slice(0, 16) : '',
    sortOrder: String(s.sortOrder),
    status: s.status,
    targetDevice: s.targetDevice,
  };
}

function formToPayload(f: FormState): CreateSliderPayload {
  return {
    title: f.title,
    subtitle: f.subtitle || undefined,
    description: f.description || undefined,
    desktopMediaId: f.desktopMediaId || undefined,
    mobileMediaId: f.mobileMediaId || undefined,
    videoMediaId: f.videoMediaId || undefined,
    linkType: f.linkType,
    linkValue: f.linkValue || undefined,
    buttonText: f.buttonText || undefined,
    startAt: f.startAt ? new Date(f.startAt).toISOString() : undefined,
    endAt: f.endAt ? new Date(f.endAt).toISOString() : undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
    targetDevice: f.targetDevice,
  };
}

interface SliderFormProps {
  form: FormState;
  onChange: (f: FormState) => void;
  mediaAssets: MediaAsset[];
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit: boolean;
}

function SliderForm({
  form,
  onChange,
  mediaAssets,
  saving,
  error,
  onSubmit,
  onCancel,
  isEdit,
}: SliderFormProps) {
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 3,
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 12 };

  const mediaOptions = (
    <>
      <option value="">— Seçilmedi —</option>
      {mediaAssets.map((a) => (
        <option key={a.id} value={a.id}>
          {a.originalName}
        </option>
      ))}
    </>
  );

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 20,
        background: '#fafafa',
        marginTop: 16,
      }}
    >
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>
        {isEdit ? 'Slider Düzenle' : 'Yeni Slider'}
      </h3>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            fontSize: 13,
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        {/* Title */}
        <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Başlık *</label>
          <input style={inputStyle} value={form.title} onChange={set('title')} placeholder="Slider başlığı" />
        </div>

        {/* Subtitle */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Alt Başlık</label>
          <input style={inputStyle} value={form.subtitle} onChange={set('subtitle')} placeholder="Alt başlık" />
        </div>

        {/* Button Text */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Buton Metni</label>
          <input style={inputStyle} value={form.buttonText} onChange={set('buttonText')} placeholder="Butona tıkla" />
        </div>

        {/* Description */}
        <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Açıklama</label>
          <textarea
            style={{ ...inputStyle, height: 64, resize: 'vertical' }}
            value={form.description}
            onChange={set('description')}
            placeholder="Slider açıklaması"
          />
        </div>

        {/* Desktop Media */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Masaüstü Medya</label>
          <select style={inputStyle} value={form.desktopMediaId} onChange={set('desktopMediaId')}>
            {mediaOptions}
          </select>
        </div>

        {/* Mobile Media */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Mobil Medya</label>
          <select style={inputStyle} value={form.mobileMediaId} onChange={set('mobileMediaId')}>
            {mediaOptions}
          </select>
        </div>

        {/* Video Media */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Video Medya</label>
          <select style={inputStyle} value={form.videoMediaId} onChange={set('videoMediaId')}>
            {mediaOptions}
          </select>
        </div>

        {/* Link Type */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Bağlantı Türü</label>
          <select style={inputStyle} value={form.linkType} onChange={set('linkType')}>
            {(Object.keys(LINK_TYPE_LABELS) as SliderLinkType[]).map((k) => (
              <option key={k} value={k}>{LINK_TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>

        {/* Link Value */}
        {form.linkType !== 'NONE' && (
          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Bağlantı Değeri</label>
            <input
              style={inputStyle}
              value={form.linkValue}
              onChange={set('linkValue')}
              placeholder={form.linkType === 'EXTERNAL_URL' ? 'https://...' : 'Değer girin'}
            />
          </div>
        )}

        {/* Start At */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Başlangıç Tarihi</label>
          <input type="datetime-local" style={inputStyle} value={form.startAt} onChange={set('startAt')} />
        </div>

        {/* End At */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Bitiş Tarihi</label>
          <input type="datetime-local" style={inputStyle} value={form.endAt} onChange={set('endAt')} />
        </div>

        {/* Target Device */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Hedef Cihaz</label>
          <select style={inputStyle} value={form.targetDevice} onChange={set('targetDevice')}>
            <option value="ALL">Tümü</option>
            <option value="DESKTOP">Masaüstü</option>
            <option value="MOBILE">Mobil</option>
          </select>
        </div>

        {/* Sort Order */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Sıralama</label>
          <input type="number" min={0} style={inputStyle} value={form.sortOrder} onChange={set('sortOrder')} />
        </div>

        {/* Status */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Durum</label>
          <select style={inputStyle} value={form.status} onChange={set('status')}>
            <option value="DRAFT">Taslak</option>
            <option value="SCHEDULED">Zamanlanmış</option>
            <option value="PUBLISHED">Yayında</option>
            <option value="ARCHIVED">Arşivlendi</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 16px',
            fontSize: 13,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Oluştur'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: '#fff',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          İptal
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SlidersPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();

  const [sliders, setSliders] = useState<Slider[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<SliderStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');

  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingSlider, setEditingSlider] = useState<Slider | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = activeTenantId;
  const mallId = activeMallId ?? undefined;

  const loadSliders = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiSlidersList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setSliders(data.sliders);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sliders');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch]);

  const loadMedia = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    try {
      const data = await apiMediaList(accessToken, tenantId, { limit: 200 });
      setMediaAssets(data.assets);
    } catch {
      setMediaAssets([]);
    }
  }, [accessToken, tenantId]);

  useEffect(() => {
    void loadSliders();
  }, [loadSliders]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  function openCreate() {
    setEditingSlider(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(slider: Slider) {
    setEditingSlider(slider);
    setForm(sliderToForm(slider));
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingSlider(null);
    setFormError(null);
  }

  async function handleSubmit() {
    if (!accessToken || !tenantId || !form.title.trim()) {
      setFormError('Başlık zorunludur.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = formToPayload(form);
      if (editingSlider) {
        const updated = await apiSliderUpdate(accessToken, tenantId, editingSlider.id, payload);
        setSliders((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        toast.success('Slider güncellendi');
      } else {
        const created = await apiSliderCreate(accessToken, tenantId, payload, mallId);
        setSliders((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        toast.success('Slider oluşturuldu');
      }
      setShowForm(false);
      setEditingSlider(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm('Bu slider\'ı silmek istediğinizden emin misiniz?')) return;
    try {
      await apiSliderDelete(accessToken, tenantId, id);
      setSliders((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => t - 1);
      toast.success('Slider silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme başarısız');
    }
  }

  async function handlePublish(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiSliderPublish(accessToken, tenantId, id);
      setSliders((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success('Slider yayınlandı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayınlama başarısız');
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiSliderArchive(accessToken, tenantId, id);
      setSliders((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success('Slider arşivlendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Arşivleme başarısız');
    }
  }

  if (!tenantId) {
    return (
      <PageContainer>
        <PageHeader title="Slider Yönetimi" />
        <EmptyState
          title="Tenant seçilmedi"
          description="Slider yönetimi için üstten bir tenant seçin."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Slider Yönetimi"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} slider</span>}
        action={<Button variant="primary" onClick={openCreate}>+ Yeni Slider</Button>}
      />
    <div style={{ fontSize: 13 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          placeholder="Başlığa göre ara…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          style={{
            padding: '5px 10px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            width: 200,
          }}
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as SliderStatus | '')}
          style={{
            padding: '5px 10px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 6,
          }}
        >
          <option value="">Tüm Durumlar</option>
          <option value="DRAFT">Taslak</option>
          <option value="SCHEDULED">Zamanlanmış</option>
          <option value="PUBLISHED">Yayında</option>
          <option value="ARCHIVED">Arşivlendi</option>
        </select>

        <button
          type="button"
          onClick={() => void loadSliders()}
          style={{
            padding: '5px 12px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Filtrele
        </button>

        <span style={{ marginLeft: 'auto', color: '#6b7280' }} />
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Form panel */}
      {showForm && (
        <SliderForm
          form={form}
          onChange={setForm}
          mediaAssets={mediaAssets}
          saving={saving}
          error={formError}
          onSubmit={() => void handleSubmit()}
          onCancel={cancelForm}
          isEdit={!!editingSlider}
        />
      )}
      {showForm && editingSlider && (
        <TranslationPanel
          entityType="SLIDER"
          entityId={editingSlider.id}
          fields={['title', 'subtitle', 'description', 'buttonText']}
          title="Çeviriler"
        />
      )}

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : sliders.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            border: '2px dashed #d1d5db',
            borderRadius: 8,
            color: '#6b7280',
          }}
        >
          <p>Henüz slider yok.</p>
          <p>"+ Yeni Slider" butonu ile ilk slider'ınızı oluşturun.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Başlık</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Durum</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Cihaz</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Medya</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Sıra</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#374151' }}>Oluşturulma</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, color: '#374151' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {sliders.map((slider) => (
                <tr
                  key={slider.id}
                  style={{ borderBottom: '1px solid #f3f4f6' }}
                >
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ fontWeight: 600 }}>{slider.title}</div>
                    {slider.subtitle && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{slider.subtitle}</div>
                    )}
                    {/* Media preview */}
                    {slider.desktopMedia && (
                      <div style={{ marginTop: 4 }}>
                        <img
                          src={slider.desktopMedia.publicUrl}
                          alt={slider.desktopMedia.originalName}
                          style={{
                            width: 60,
                            height: 36,
                            objectFit: 'cover',
                            borderRadius: 3,
                            border: '1px solid #e5e7eb',
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <StatusBadge status={slider.status} />
                    {slider.status === 'SCHEDULED' && slider.startAt && (
                      <div style={{ fontSize: 10, color: '#92400e', marginTop: 4 }}>
                        Yayın: {new Date(slider.startAt).toLocaleString('tr-TR')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <DeviceBadge device={slider.targetDevice} />
                  </td>
                  <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 11 }}>
                    {[
                      slider.desktopMediaId && 'Masaüstü',
                      slider.mobileMediaId && 'Mobil',
                      slider.videoMediaId && 'Video',
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#6b7280', textAlign: 'center' }}>
                    {slider.sortOrder}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#6b7280' }}>
                    {new Date(slider.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => openEdit(slider)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Düzenle
                      </button>

                      {slider.status !== 'PUBLISHED' && (
                        <button
                          type="button"
                          onClick={() => void handlePublish(slider.id)}
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            border: '1px solid #86efac',
                            borderRadius: 4,
                            background: '#f0fdf4',
                            color: '#15803d',
                            cursor: 'pointer',
                          }}
                        >
                          Yayınla
                        </button>
                      )}

                      {slider.status !== 'ARCHIVED' && (
                        <button
                          type="button"
                          onClick={() => void handleArchive(slider.id)}
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: '#f9fafb',
                            color: '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          Arşivle
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleDelete(slider.id)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          border: '1px solid #fecaca',
                          borderRadius: 4,
                          background: '#fef2f2',
                          color: '#b91c1c',
                          cursor: 'pointer',
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </PageContainer>
  );
}
