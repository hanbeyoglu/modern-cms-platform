import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { MultilingualContentFields, SLIDER_I18N_FIELDS } from '../components/MultilingualContentFields';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { ContentChannelFields } from '../components/ContentChannelFields';
import { validateRangeSchedule } from '../lib/publishing-workflow';
import { DEFAULT_CONTENT_CHANNELS } from '../lib/content-channels';
import { Button } from '../components/ui/Button';
import {
  apiLocalesList,
  apiMediaList,
  apiSliderArchive,
  apiSliderCreate,
  apiSliderDelete,
  apiSliderPublish,
  apiSlidersList,
  apiSliderUpdate,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  type CmsLocale,
  type CreateSliderPayload,
  type MediaAsset,
  type ContentChannel,
  type Slider,
  type SliderLinkType,
  type SliderStatus,
  type SliderTargetDevice,
} from '../lib/api';
import { usePermission } from '../hooks/usePermission';

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
  channels: ContentChannel[];
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
  channels: [...DEFAULT_CONTENT_CHANNELS],
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
    channels: s.channels?.length ? [...s.channels] : [...DEFAULT_CONTENT_CHANNELS],
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
    channels: f.channels.length ? f.channels : undefined,
  };
}

interface SliderFormProps {
  form: FormState;
  onChange: (f: FormState) => void;
  onDirty: () => void;
  mediaAssets: MediaAsset[];
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit: boolean;
  tenantLocales: CmsLocale[];
  contentLocaleTab: string | null;
  onLocaleTabChange: (id: string) => void;
  localeDrafts: Record<string, Record<string, string>>;
  setLocaleDrafts: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  setI18nDirty: (dirty: boolean) => void;
}

function SliderForm({
  form,
  onChange,
  onDirty,
  mediaAssets,
  saving,
  error,
  onSubmit,
  onCancel,
  isEdit,
  tenantLocales,
  contentLocaleTab,
  onLocaleTabChange,
  localeDrafts,
  setLocaleDrafts,
  setI18nDirty,
}: SliderFormProps) {
  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      onChange({ ...form, [k]: e.target.value });
      onDirty();
    };

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
        <div style={{ gridColumn: '1 / -1' }}>
          {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
            <MultilingualContentFields
              locales={tenantLocales}
              fields={SLIDER_I18N_FIELDS}
              activeLocaleId={contentLocaleTab}
              onTabChange={onLocaleTabChange}
              defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
              getValue={(localeId, field) => {
                const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                if (defaultLocaleId && localeId === defaultLocaleId) {
                  return String(form[field as keyof FormState] ?? '');
                }
                return localeDrafts[localeId]?.[field] ?? '';
              }}
              setValue={(localeId, field, value) => {
                const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                if (defaultLocaleId && localeId === defaultLocaleId) {
                  onChange({ ...form, [field]: value });
                  onDirty();
                  return;
                }
                setLocaleDrafts((drafts) => ({
                  ...drafts,
                  [localeId]: { ...drafts[localeId], [field]: value },
                }));
                setI18nDirty(true);
              }}
              onCopyFromDefault={(targetId) => {
                setLocaleDrafts((drafts) => ({
                  ...drafts,
                  [targetId]: {
                    title: form.title,
                    subtitle: form.subtitle,
                    description: form.description,
                    buttonText: form.buttonText,
                  },
                }));
                setI18nDirty(true);
              }}
              disabled={saving}
            />
          ) : (
            <>
              <div style={fieldStyle}>
                <label style={labelStyle}>Başlık *</label>
                <input style={inputStyle} value={form.title} onChange={set('title')} placeholder="Slider başlığı" />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Alt Başlık</label>
                <input style={inputStyle} value={form.subtitle} onChange={set('subtitle')} placeholder="Alt başlık" />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Buton Metni</label>
                <input
                  style={inputStyle}
                  value={form.buttonText}
                  onChange={set('buttonText')}
                  placeholder="Butona tıkla"
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Açıklama</label>
                <textarea
                  style={{ ...inputStyle, height: 64, resize: 'vertical' }}
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Slider açıklaması"
                />
              </div>
            </>
          )}
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

        <div style={{ gridColumn: '1 / -1', marginBottom: 12 }}>
          <ContentChannelFields
            channels={form.channels}
            onChange={(channels) => {
              onChange({ ...form, channels });
              onDirty();
            }}
            labelStyle={labelStyle}
            disabled={saving}
          />
        </div>
        <div style={{ gridColumn: '1 / -1', marginBottom: 12 }}>
          <PublishingWorkflowFields
            mode="range"
            status={form.status}
            startAt={form.startAt}
            endAt={form.endAt}
            onStatusChange={(status) => {
              onChange({ ...form, status });
              onDirty();
            }}
            onStartAtChange={(startAt) => {
              onChange({ ...form, startAt });
              onDirty();
            }}
            onEndAtChange={(endAt) => {
              onChange({ ...form, endAt });
              onDirty();
            }}
            labelStyle={labelStyle}
            inputStyle={inputStyle}
          />
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
  const { can } = usePermission();

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
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);
  const [sliderFormDirty, setSliderFormDirty] = useState(false);

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

  useEffect(() => {
    if (!showForm || !accessToken || !tenantId) {
      setTenantLocales([]);
      setContentLocaleTab(null);
      setLocaleDrafts({});
      return;
    }
    void (async () => {
      try {
        const locs = await apiLocalesList(accessToken, tenantId);
        setTenantLocales(locs);
        const activeLocales = locs.filter((l) => l.isActive);
        const defaultLocale = locs.find((l) => l.isDefault);
        setContentLocaleTab((prev) => {
          if (prev && activeLocales.some((l) => l.id === prev)) return prev;
          return defaultLocale?.id ?? activeLocales[0]?.id ?? null;
        });
        if (editingSlider) {
          const translations = await apiTranslationsList(accessToken, tenantId, {
            entityType: 'SLIDER',
            entityId: editingSlider.id,
          });
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            drafts[loc.id] = {
              title: '',
              subtitle: '',
              description: '',
              buttonText: '',
            };
            for (const field of SLIDER_I18N_FIELDS) {
              drafts[loc.id][field] =
                translations.find((row) => row.localeId === loc.id && row.field === field)?.value ?? '';
            }
          }
          setLocaleDrafts(drafts);
          setI18nDirty(false);
        } else {
          setLocaleDrafts({});
          setI18nDirty(false);
        }
      } catch {
        setTenantLocales([]);
        setLocaleDrafts({});
      }
    })();
  }, [showForm, editingSlider?.id, accessToken, tenantId]);

  useEffect(() => {
    if (!showForm || (!i18nDirty && !sliderFormDirty)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [showForm, i18nDirty, sliderFormDirty]);

  function openCreate() {
    setEditingSlider(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setLocaleDrafts({});
    setI18nDirty(false);
    setSliderFormDirty(false);
    setShowForm(true);
  }

  function openEdit(slider: Slider) {
    setEditingSlider(slider);
    setForm(sliderToForm(slider));
    setFormError(null);
    setSliderFormDirty(false);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingSlider(null);
    setFormError(null);
    setLocaleDrafts({});
    setTenantLocales([]);
    setContentLocaleTab(null);
    setI18nDirty(false);
    setSliderFormDirty(false);
  }

  const flushSliderTranslations = useCallback(
    async (sliderId: string) => {
      if (!accessToken || !tenantId || !can('translation:create')) return;
      const defaultLocale = tenantLocales.find((l) => l.isDefault);
      const translations = await apiTranslationsList(accessToken, tenantId, {
        entityType: 'SLIDER',
        entityId: sliderId,
      });
      const idByKey = new Map(translations.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
      for (const loc of tenantLocales.filter((l) => l.isActive)) {
        if (!defaultLocale || loc.id === defaultLocale.id) continue;
        const slice = localeDrafts[loc.id] ?? {};
        for (const field of SLIDER_I18N_FIELDS) {
          const value = (slice[field] ?? '').trim();
          const prevId = idByKey.get(`${loc.id}:${field}`);
          if (!value) {
            if (prevId && can('translation:delete')) {
              await apiTranslationDelete(accessToken, tenantId, prevId);
            }
            continue;
          }
          await apiTranslationUpsert(accessToken, tenantId, {
            localeCode: loc.code,
            entityType: 'SLIDER',
            entityId: sliderId,
            field,
            value,
          });
        }
      }
    },
    [accessToken, tenantId, tenantLocales, localeDrafts, can],
  );

  async function handleSubmit() {
    if (!accessToken || !tenantId || !form.title.trim()) {
      setFormError('Başlık zorunludur.');
      return;
    }
    const scheduleError = validateRangeSchedule(form.status, form.startAt);
    if (scheduleError) {
      setFormError(scheduleError);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = formToPayload(form);
      if (editingSlider) {
        const updated = await apiSliderUpdate(accessToken, tenantId, editingSlider.id, payload);
        setSliders((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        await flushSliderTranslations(updated.id);
        toast.success('Slider güncellendi');
      } else {
        const created = await apiSliderCreate(accessToken, tenantId, payload, mallId);
        setSliders((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        await flushSliderTranslations(created.id);
        toast.success('Slider oluşturuldu');
      }
      cancelForm();
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
          <option value="">Aktif (arşiv hariç)</option>
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
          onDirty={() => setSliderFormDirty(true)}
          mediaAssets={mediaAssets}
          saving={saving}
          error={formError}
          onSubmit={() => void handleSubmit()}
          onCancel={cancelForm}
          isEdit={!!editingSlider}
          tenantLocales={tenantLocales}
          contentLocaleTab={contentLocaleTab}
          onLocaleTabChange={(id) => setContentLocaleTab(id)}
          localeDrafts={localeDrafts}
          setLocaleDrafts={setLocaleDrafts}
          setI18nDirty={setI18nDirty}
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
