import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { CAMPAIGN_I18N_FIELDS, MultilingualContentFields } from '../components/MultilingualContentFields';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { ContentChannelFields } from '../components/ContentChannelFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import {
  buildCampaignTranslationsPayload,
  getCampaignSaveBlocker,
} from '../lib/campaign-event-form-validation';
import { DEFAULT_CONTENT_CHANNELS } from '../lib/content-channels';
import { Button } from '../components/ui/Button';
import { LinkedSliderGroupsSection } from '../components/LinkedSliderGroupsSection';
import {
  apiCampaignArchive,
  apiCampaignCreate,
  apiCampaignDelete,
  apiCampaignPublish,
  apiCampaignUpdate,
  apiCampaignsList,
  apiLocalesList,
  apiMallStoresList,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  API_MAX_PAGE_SIZE,
  type CmsLocale,
} from '../lib/api';
import type {
  CmsCampaign,
  ContentChannel,
  ContentStatus,
  CreateCampaignPayload,
  MallStore,
} from '../lib/api';
import { usePermission } from '../hooks/usePermission';
import { useMallRequired } from '../hooks/useMallRequired';
import { MallRequiredStates } from '../components/MallRequiredStates';

const STATUS_STYLE: Record<ContentStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv' },
};

function StatusBadge({ status }: { status: ContentStatus }) {
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

function storeRowLabel(store: CmsCampaign['store']): string {
  if (!store) return '—';
  const base = store.globalStore.name;
  return store.localName ? `${base} — ${store.localName}` : base;
}

type FormState = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  sameImageForAllLocales: boolean;
  sharedCoverImageId: string;
  coverMediaWidthOverride: string;
  coverMediaHeightOverride: string;
  publishStartAt: string;
  publishEndAt: string;
  campaignStartAt: string;
  campaignEndAt: string;
  terms: string;
  couponCode: string;
  buttonText: string;
  linkUrl: string;
  storeId: string;
  sortOrder: string;
  status: ContentStatus;
  channels: ContentChannel[];
  dynamicJson: string;
};

const EMPTY: FormState = {
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  sameImageForAllLocales: true,
  sharedCoverImageId: '',
  coverMediaWidthOverride: '',
  coverMediaHeightOverride: '',
  publishStartAt: '',
  publishEndAt: '',
  campaignStartAt: '',
  campaignEndAt: '',
  terms: '',
  couponCode: '',
  buttonText: '',
  linkUrl: '',
  storeId: '',
  sortOrder: '0',
  status: 'DRAFT',
  channels: [...DEFAULT_CONTENT_CHANNELS],
  dynamicJson: '',
};

function cToForm(c: CmsCampaign): FormState {
  return {
    title: c.title,
    slug: c.slug,
    shortDescription: c.shortDescription ?? '',
    description: c.description ?? '',
    sameImageForAllLocales: c.sameImageForAllLocales ?? true,
    sharedCoverImageId: c.sharedCoverImageId ?? '',
    coverMediaWidthOverride: c.coverMediaWidthOverride ? String(c.coverMediaWidthOverride) : '',
    coverMediaHeightOverride: c.coverMediaHeightOverride ? String(c.coverMediaHeightOverride) : '',
    publishStartAt: c.publishStartAt ? c.publishStartAt.slice(0, 16) : '',
    publishEndAt: c.publishEndAt ? c.publishEndAt.slice(0, 16) : '',
    campaignStartAt: c.campaignStartAt ? c.campaignStartAt.slice(0, 16) : '',
    campaignEndAt: c.campaignEndAt ? c.campaignEndAt.slice(0, 16) : '',
    terms: c.terms ?? '',
    couponCode: c.couponCode ?? '',
    buttonText: c.buttonText ?? '',
    linkUrl: c.linkUrl ?? '',
    storeId: c.storeId ?? '',
    sortOrder: String(c.sortOrder),
    status: c.status,
    channels: c.channels?.length ? [...c.channels] : [...DEFAULT_CONTENT_CHANNELS],
    dynamicJson: c.dynamicFieldsJson ? JSON.stringify(c.dynamicFieldsJson, null, 2) : '',
  };
}

function formToPayload(f: FormState, localeDrafts: Record<string, Record<string, string>>, tenantLocales: CmsLocale[]): CreateCampaignPayload {
  return {
    title: f.title,
    slug: f.slug.trim() || undefined,
    shortDescription: f.shortDescription || undefined,
    description: f.description || undefined,
    sameImageForAllLocales: f.sameImageForAllLocales,
    sharedCoverImageId: f.sharedCoverImageId || undefined,
    coverMediaWidthOverride: parseOptionalDimension(f.coverMediaWidthOverride),
    coverMediaHeightOverride: parseOptionalDimension(f.coverMediaHeightOverride),
    publishStartAt: f.publishStartAt ? new Date(f.publishStartAt).toISOString() : undefined,
    publishEndAt: f.publishEndAt ? new Date(f.publishEndAt).toISOString() : undefined,
    campaignStartAt: f.campaignStartAt ? new Date(f.campaignStartAt).toISOString() : undefined,
    campaignEndAt: f.campaignEndAt ? new Date(f.campaignEndAt).toISOString() : undefined,
    terms: f.terms || undefined,
    couponCode: f.couponCode || undefined,
    buttonText: f.buttonText || undefined,
    linkUrl: f.linkUrl || undefined,
    storeId: f.storeId || undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
    channels: f.channels.length ? f.channels : undefined,
    translations: buildCampaignTranslationsPayload(tenantLocales, localeDrafts),
  };
}

function parseOptionalDimension(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function CampaignsPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const { can } = usePermission();
  const [items, setItems] = useState<CmsCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [mallStores, setMallStores] = useState<MallStore[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsCampaign | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);
  const [campaignFormDirty, setCampaignFormDirty] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';

  const loadCampaigns = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCampaignsList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setItems(data.campaigns);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kampanyalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch]);

  const loadStores = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId) {
      setMallStores([]);
      return;
    }
    try {
      const data = await apiMallStoresList(accessToken, tenantId, mallId, { limit: API_MAX_PAGE_SIZE });
      setMallStores(data.items);
    } catch {
      setMallStores([]);
    }
  }, [accessToken, tenantId, mallId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

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
        if (editing) {
          const translations = await apiTranslationsList(accessToken, tenantId, {
            entityType: 'CAMPAIGN',
            entityId: editing.id,
          });
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            const tableTr = editing.translations?.find((t) => t.localeId === loc.id);
            drafts[loc.id] = {
              title: tableTr?.title ?? '',
              shortDescription: '',
              description: tableTr?.description ?? '',
              terms: '',
              buttonText: tableTr?.buttonText ?? '',
              coverImageId: tableTr?.coverImageId ?? '',
            };
            for (const field of CAMPAIGN_I18N_FIELDS) {
              if (field === 'title' || field === 'description' || field === 'buttonText') {
                if (!drafts[loc.id][field]) {
                  drafts[loc.id][field] =
                    translations.find((row) => row.localeId === loc.id && row.field === field)?.value ?? '';
                }
              } else {
                drafts[loc.id][field] =
                  translations.find((row) => row.localeId === loc.id && row.field === field)?.value ?? '';
              }
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
  }, [showForm, editing?.id, accessToken, tenantId]);

  useEffect(() => {
    if (!showForm || (!i18nDirty && !campaignFormDirty)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [showForm, i18nDirty, campaignFormDirty]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setLocaleDrafts({});
    setI18nDirty(false);
    setCampaignFormDirty(false);
    setShowForm(true);
  }

  function openEdit(c: CmsCampaign) {
    setEditing(c);
    setForm(cToForm(c));
    setFormError(null);
    setCampaignFormDirty(false);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
    setLocaleDrafts({});
    setTenantLocales([]);
    setContentLocaleTab(null);
    setI18nDirty(false);
    setCampaignFormDirty(false);
  }

  const flushCampaignTranslations = useCallback(
    async (campaignId: string) => {
      if (!accessToken || !tenantId || !can('translation:create')) return;
      const defaultLocale = tenantLocales.find((l) => l.isDefault);
      const translations = await apiTranslationsList(accessToken, tenantId, {
        entityType: 'CAMPAIGN',
        entityId: campaignId,
      });
      const idByKey = new Map(translations.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
      for (const loc of tenantLocales.filter((l) => l.isActive)) {
        if (!defaultLocale || loc.id === defaultLocale.id) continue;
        const slice = localeDrafts[loc.id] ?? {};
        for (const field of CAMPAIGN_I18N_FIELDS) {
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
            entityType: 'CAMPAIGN',
            entityId: campaignId,
            field,
            value,
          });
        }
      }
    },
    [accessToken, tenantId, tenantLocales, localeDrafts, can],
  );

  async function handleSubmit() {
    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
    const blocker = getCampaignSaveBlocker({
      title: form.title,
      status: form.status,
      publishStartAt: form.publishStartAt,
      campaignStartAt: form.campaignStartAt,
      sameImageForAllLocales: form.sameImageForAllLocales,
      sharedCoverImageId: form.sharedCoverImageId,
      defaultLocaleCoverImageId: defaultLocaleId ? form.sharedCoverImageId : undefined,
    });
    if (blocker) {
      setFormError(blocker);
      return;
    }
    if (!accessToken || !tenantId) return;
    let dynamicFieldsJson: Record<string, unknown> | undefined;
    const raw = form.dynamicJson.trim();
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setFormError('Dinamik alanlar geçerli bir JSON nesnesi olmalıdır.');
          return;
        }
        dynamicFieldsJson = parsed as Record<string, unknown>;
      } catch {
        setFormError('Dinamik alanlar geçerli JSON değil.');
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: CreateCampaignPayload = {
        ...formToPayload(form, localeDrafts, tenantLocales),
        dynamicFieldsJson,
      };
      if (editing) {
        const updated = await apiCampaignUpdate(accessToken, tenantId, editing.id, payload, mallId);
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        await flushCampaignTranslations(updated.id);
        toast.success('Kampanya güncellendi');
      } else {
        const created = await apiCampaignCreate(accessToken, tenantId, payload, mallId);
        setItems((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        await flushCampaignTranslations(created.id);
        toast.success('Kampanya oluşturuldu');
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
    if (!window.confirm('Bu kampanyayı silmek istediğinizden emin misiniz?')) return;
    try {
      await apiCampaignDelete(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      toast.success('Kampanya silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  async function handlePublish(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiCampaignPublish(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Kampanya yayınlandı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayınlanamadı');
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiCampaignArchive(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Kampanya arşivlendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Arşivlenemedi');
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '5px 8px',
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
    marginBottom: 3,
  };

  return (
    <MallRequiredStates title="Kampanyalar" status={mallCtx}>
    <PageContainer>
      <PageHeader
        title="Kampanyalar"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} kampanya</span>}
        action={<Button variant="primary" onClick={openCreate}>+ Yeni Kampanya</Button>}
      />
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Başlığa göre ara…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          style={{ ...inputStyle, width: 200 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ContentStatus | '')}
          style={inputStyle}
        >
          <option value="">Aktif (arşiv hariç)</option>
          <option value="DRAFT">Taslak</option>
          <option value="SCHEDULED">Zamanlanmış</option>
          <option value="PUBLISHED">Yayında</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>
        <button type="button" onClick={() => void loadCampaigns()} style={inputStyle}>
          Filtrele
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading && <LoadingState />}

      {showForm && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            background: '#fafafa',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{editing ? 'Kampanyayı düzenle' : 'Yeni kampanya'}</h3>
          {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <div>
              <label style={labelStyle}>Slug</label>
              <input
                style={inputStyle}
                value={form.slug}
                onChange={(e) => {
                  setForm({ ...form, slug: e.target.value });
                  setCampaignFormDirty(true);
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.sameImageForAllLocales}
                  disabled={saving}
                  onChange={(e) => {
                    setForm({ ...form, sameImageForAllLocales: e.target.checked });
                    setCampaignFormDirty(true);
                  }}
                />
                Tüm diller için aynı kapak görseli
              </label>
            </div>
            {form.sameImageForAllLocales ? (
              <div>
                <ContextualMediaPicker
                  context="CAMPAIGN_COVER"
                  value={form.sharedCoverImageId}
                  mallId={mallId}
                  onChange={(id) => {
                    setForm({ ...form, sharedCoverImageId: id });
                    setCampaignFormDirty(true);
                  }}
                  dimensionOverride={{
                    width: parseOptionalDimension(form.coverMediaWidthOverride),
                    height: parseOptionalDimension(form.coverMediaHeightOverride),
                  }}
                  onDimensionOverrideChange={(dimensions) => {
                    setForm({
                      ...form,
                      coverMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                      coverMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                    });
                    setCampaignFormDirty(true);
                  }}
                />
              </div>
            ) : (
              tenantLocales.filter((l) => l.isActive).length > 0 &&
              contentLocaleTab && (
                <ContextualMediaPicker
                  context="CAMPAIGN_COVER"
                  value={
                    contentLocaleTab === tenantLocales.find((l) => l.isDefault)?.id
                      ? form.sharedCoverImageId
                      : localeDrafts[contentLocaleTab]?.coverImageId ?? ''
                  }
                  mallId={mallId}
                  onChange={(mediaId) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (contentLocaleTab === defaultLocaleId) {
                      setForm({ ...form, sharedCoverImageId: mediaId });
                      setCampaignFormDirty(true);
                      return;
                    }
                    setLocaleDrafts((d) => ({
                      ...d,
                      [contentLocaleTab]: { ...d[contentLocaleTab], coverImageId: mediaId },
                    }));
                    setI18nDirty(true);
                  }}
                  dimensionOverride={{
                    width: parseOptionalDimension(form.coverMediaWidthOverride),
                    height: parseOptionalDimension(form.coverMediaHeightOverride),
                  }}
                  onDimensionOverrideChange={(dimensions) => {
                    setForm({
                      ...form,
                      coverMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                      coverMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                    });
                    setCampaignFormDirty(true);
                  }}
                />
              )
            )}
            <div>
              <label style={labelStyle}>AVM mağazası</label>
              <select
                style={inputStyle}
                value={form.storeId}
                onChange={(e) => {
                  setForm({ ...form, storeId: e.target.value });
                  setCampaignFormDirty(true);
                }}
                disabled={!mallId}
              >
                <option value="">—</option>
                {mallStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.globalStore.name}
                    {s.localName ? ` — ${s.localName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <ContentChannelFields
                channels={form.channels}
                onChange={(channels) => {
                  setForm({ ...form, channels });
                  setCampaignFormDirty(true);
                }}
                labelStyle={labelStyle}
                disabled={saving}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <PublishingWorkflowFields
                mode="page"
                status={form.status}
                publishAt={form.publishStartAt}
                unpublishAt={form.publishEndAt}
                onStatusChange={(status) => {
                  setForm({ ...form, status });
                  setCampaignFormDirty(true);
                }}
                onPublishAtChange={(publishStartAt) => {
                  setForm({ ...form, publishStartAt });
                  setCampaignFormDirty(true);
                }}
                onUnpublishAtChange={(publishEndAt) => {
                  setForm({ ...form, publishEndAt });
                  setCampaignFormDirty(true);
                }}
                labelStyle={labelStyle}
                inputStyle={inputStyle}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label style={labelStyle}>Kampanya başlangıcı</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.campaignStartAt}
                  onChange={(e) => {
                    setForm({ ...form, campaignStartAt: e.target.value });
                    setCampaignFormDirty(true);
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Kampanya bitişi</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.campaignEndAt}
                  onChange={(e) => {
                    setForm({ ...form, campaignEndAt: e.target.value });
                    setCampaignFormDirty(true);
                  }}
                />
              </div>
            </div>
            {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
              <MultilingualContentFields
                locales={tenantLocales}
                fields={CAMPAIGN_I18N_FIELDS}
                activeLocaleId={contentLocaleTab}
                onTabChange={(id) => setContentLocaleTab(id)}
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
                    setForm((prev) => ({ ...prev, [field]: value }));
                    setCampaignFormDirty(true);
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
                      shortDescription: form.shortDescription,
                      description: form.description,
                      terms: form.terms,
                      buttonText: form.buttonText,
                    },
                  }));
                  setI18nDirty(true);
                }}
                disabled={saving}
              />
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Başlık *</label>
                  <input
                    style={inputStyle}
                    value={form.title}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      setCampaignFormDirty(true);
                    }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Kısa açıklama</label>
                  <input
                    style={inputStyle}
                    value={form.shortDescription}
                    onChange={(e) => {
                      setForm({ ...form, shortDescription: e.target.value });
                      setCampaignFormDirty(true);
                    }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Açıklama</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 72 }}
                    value={form.description}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value });
                      setCampaignFormDirty(true);
                    }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Şartlar</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 64 }}
                    value={form.terms}
                    onChange={(e) => {
                      setForm({ ...form, terms: e.target.value });
                      setCampaignFormDirty(true);
                    }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Buton metni</label>
                  <input
                    style={inputStyle}
                    value={form.buttonText}
                    onChange={(e) => {
                      setForm({ ...form, buttonText: e.target.value });
                      setCampaignFormDirty(true);
                    }}
                  />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Kupon kodu</label>
              <input
                style={inputStyle}
                value={form.couponCode}
                onChange={(e) => {
                  setForm({ ...form, couponCode: e.target.value });
                  setCampaignFormDirty(true);
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Link URL</label>
              <input
                style={inputStyle}
                value={form.linkUrl}
                onChange={(e) => {
                  setForm({ ...form, linkUrl: e.target.value });
                  setCampaignFormDirty(true);
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Sıra</label>
              <input
                style={inputStyle}
                value={form.sortOrder}
                onChange={(e) => {
                  setForm({ ...form, sortOrder: e.target.value });
                  setCampaignFormDirty(true);
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>dynamicFieldsJson</label>
              <textarea
                style={{ ...inputStyle, minHeight: 100, fontFamily: 'monospace' }}
                value={form.dynamicJson}
                onChange={(e) => {
                  setForm({ ...form, dynamicJson: e.target.value });
                  setCampaignFormDirty(true);
                }}
              />
            </div>
            {editing && (
              <LinkedSliderGroupsSection
                entityType="CAMPAIGN"
                entityId={editing.id}
                mallId={mallId}
              />
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button type="button" disabled={saving} onClick={() => void handleSubmit()} style={{ padding: '6px 14px' }}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" onClick={cancelForm}>
              İptal
            </button>
          </div>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: 8 }}>Başlık</th>
            <th style={{ padding: 8 }}>Mağaza</th>
            <th style={{ padding: 8 }}>Durum</th>
            <th style={{ padding: 8 }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 8 }}>
                <strong>{c.title}</strong>
                <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.slug}</div>
              </td>
              <td style={{ padding: 8, color: '#6b7280' }}>
                {storeRowLabel(c.store)}
              </td>
              <td style={{ padding: 8 }}>
                <StatusBadge status={c.status} />
                {c.status === 'SCHEDULED' && c.publishStartAt && (
                  <div style={{ fontSize: 10, color: '#92400e', marginTop: 4 }}>
                    Yayın: {new Date(c.publishStartAt).toLocaleString('tr-TR')}
                  </div>
                )}
              </td>
              <td style={{ padding: 8 }}>
                <button type="button" onClick={() => openEdit(c)} style={{ marginRight: 6 }}>
                  Düzenle
                </button>
                {c.status !== 'PUBLISHED' && (
                  <button type="button" onClick={() => void handlePublish(c.id)} style={{ marginRight: 6 }}>
                    Yayınla
                  </button>
                )}
                {c.status !== 'ARCHIVED' && (
                  <button type="button" onClick={() => void handleArchive(c.id)} style={{ marginRight: 6 }}>
                    Arşiv
                  </button>
                )}
                <button type="button" onClick={() => void handleDelete(c.id)}>
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </PageContainer>
    </MallRequiredStates>
  );
}
