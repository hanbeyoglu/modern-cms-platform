import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { MultilingualContentFields, EVENT_I18N_FIELDS } from '../components/MultilingualContentFields';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { ContentChannelFields } from '../components/ContentChannelFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import {
  buildEventTranslationsPayload,
  getEventSaveBlocker,
} from '../lib/campaign-event-form-validation';
import { DEFAULT_CONTENT_CHANNELS, formatChannels } from '../lib/content-channels';
import { Button } from '../components/ui/Button';
import { LinkedSliderGroupsSection } from '../components/LinkedSliderGroupsSection';
import {
  apiEventArchive,
  apiEventCreate,
  apiEventDelete,
  apiEventPublish,
  apiEventUpdate,
  apiEventsList,
  apiLocalesList,
  apiTranslationUpsert,
  apiTranslationDelete,
  apiTranslationsList,
  type CmsLocale,
  type CmsEvent,
  type ContentStatus,
  type ContentChannel,
  type CreateEventPayload,
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
  eventStartAt: string;
  eventEndAt: string;
  location: string;
  category: string;
  buttonText: string;
  linkUrl: string;
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
  eventStartAt: '',
  eventEndAt: '',
  location: '',
  category: '',
  buttonText: '',
  linkUrl: '',
  sortOrder: '0',
  status: 'DRAFT',
  channels: [...DEFAULT_CONTENT_CHANNELS],
  dynamicJson: '',
};

function evToForm(e: CmsEvent): FormState {
  return {
    title: e.title,
    slug: e.slug,
    shortDescription: e.shortDescription ?? '',
    description: e.description ?? '',
    sameImageForAllLocales: e.sameImageForAllLocales ?? true,
    sharedCoverImageId: e.sharedCoverImageId ?? '',
    coverMediaWidthOverride: e.coverMediaWidthOverride ? String(e.coverMediaWidthOverride) : '',
    coverMediaHeightOverride: e.coverMediaHeightOverride ? String(e.coverMediaHeightOverride) : '',
    publishStartAt: e.publishStartAt ? e.publishStartAt.slice(0, 16) : '',
    publishEndAt: e.publishEndAt ? e.publishEndAt.slice(0, 16) : '',
    eventStartAt: e.eventStartAt ? e.eventStartAt.slice(0, 16) : '',
    eventEndAt: e.eventEndAt ? e.eventEndAt.slice(0, 16) : '',
    location: e.location ?? '',
    category: e.category ?? '',
    buttonText: e.buttonText ?? '',
    linkUrl: e.linkUrl ?? '',
    sortOrder: String(e.sortOrder),
    status: e.status,
    channels: e.channels?.length ? [...e.channels] : [...DEFAULT_CONTENT_CHANNELS],
    dynamicJson: e.dynamicFieldsJson ? JSON.stringify(e.dynamicFieldsJson, null, 2) : '',
  };
}

function parseOptionalDimension(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formToPayload(
  f: FormState,
  localeDrafts: Record<string, Record<string, string>>,
  tenantLocales: CmsLocale[],
): CreateEventPayload {
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
    eventStartAt: f.eventStartAt ? new Date(f.eventStartAt).toISOString() : undefined,
    eventEndAt: f.eventEndAt ? new Date(f.eventEndAt).toISOString() : undefined,
    location: f.location || undefined,
    category: f.category || undefined,
    buttonText: f.buttonText || undefined,
    linkUrl: f.linkUrl || undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
    channels: f.channels.length ? f.channels : undefined,
    translations: buildEventTranslationsPayload(tenantLocales, localeDrafts),
  };
}

export function EventsPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const { can } = usePermission();
  const [events, setEvents] = useState<CmsEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsEvent | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);
  const [eventFormDirty, setEventFormDirty] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';

  const loadEvents = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiEventsList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etkinlikler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

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
        const act = locs.filter((l) => l.isActive);
        const def = locs.find((l) => l.isDefault);
        setContentLocaleTab((prev) => {
          if (prev && act.some((l) => l.id === prev)) return prev;
          return def?.id ?? act[0]?.id ?? null;
        });
        if (editing) {
          const tr = await apiTranslationsList(accessToken, tenantId, {
            entityType: 'EVENT',
            entityId: editing.id,
          });
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of act) {
            if (loc.id === def?.id) continue;
            const tableTr = editing.translations?.find((t) => t.localeId === loc.id);
            drafts[loc.id] = {
              title: tableTr?.title ?? '',
              shortDescription: tableTr?.shortDescription ?? '',
              description: tableTr?.description ?? '',
              buttonText: '',
              coverImageId: tableTr?.coverImageId ?? '',
            };
            for (const f of EVENT_I18N_FIELDS) {
              if (f === 'title' || f === 'description' || f === 'shortDescription' || f === 'buttonText') {
                if (!drafts[loc.id][f]) {
                  drafts[loc.id][f] =
                    tr.find((row) => row.localeId === loc.id && row.field === f)?.value ?? '';
                }
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
    if (!showForm || (!i18nDirty && !eventFormDirty)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [showForm, i18nDirty, eventFormDirty]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setLocaleDrafts({});
    setI18nDirty(false);
    setEventFormDirty(false);
    setShowForm(true);
  }

  function openEdit(e: CmsEvent) {
    setEditing(e);
    setForm(evToForm(e));
    setFormError(null);
    setEventFormDirty(false);
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
    setEventFormDirty(false);
  }

  const flushEventTranslations = useCallback(
    async (eventId: string) => {
      if (!accessToken || !tenantId || !can('translation:create')) return;
      const def = tenantLocales.find((l) => l.isDefault);
      const tr = await apiTranslationsList(accessToken, tenantId, {
        entityType: 'EVENT',
        entityId: eventId,
      });
      const idByKey = new Map(tr.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
      for (const loc of tenantLocales.filter((l) => l.isActive)) {
        if (!def || loc.id === def.id) continue;
        const slice = localeDrafts[loc.id] ?? {};
        for (const field of EVENT_I18N_FIELDS) {
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
            entityType: 'EVENT',
            entityId: eventId,
            field,
            value,
          });
        }
      }
    },
    [accessToken, tenantId, tenantLocales, localeDrafts, can],
  );

  async function handleSubmit() {
    const blocker = getEventSaveBlocker({
      title: form.title,
      status: form.status,
      publishStartAt: form.publishStartAt,
      eventStartAt: form.eventStartAt,
      sameImageForAllLocales: form.sameImageForAllLocales,
      sharedCoverImageId: form.sharedCoverImageId,
      defaultLocaleCoverImageId: form.sharedCoverImageId,
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
      const payload: CreateEventPayload = {
        ...formToPayload(form, localeDrafts, tenantLocales),
        dynamicFieldsJson,
      };
      let eventId: string;
      if (editing) {
        const updated = await apiEventUpdate(accessToken, tenantId, editing.id, payload, mallId);
        eventId = updated.id;
        setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        await flushEventTranslations(eventId);
        toast.success('Etkinlik güncellendi');
      } else {
        const created = await apiEventCreate(accessToken, tenantId, payload, mallId);
        eventId = created.id;
        setEvents((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        await flushEventTranslations(eventId);
        toast.success('Etkinlik oluşturuldu');
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
    if (!window.confirm('Bu etkinliği silmek istediğinizden emin misiniz?')) return;
    try {
      await apiEventDelete(accessToken, tenantId, id, mallId);
      setEvents((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      toast.success('Etkinlik silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  async function handlePublish(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const { event: updated, localizationWarnings } = await apiEventPublish(
        accessToken,
        tenantId,
        id,
        mallId,
      );
      setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Etkinlik yayınlandı');
      if (localizationWarnings.length > 0) {
        toast.message('Yerelleştirme uyarıları (yayın engellenmedi)', {
          description: localizationWarnings.slice(0, 6).join('\n'),
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayınlanamadı');
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiEventArchive(accessToken, tenantId, id, mallId);
      setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Etkinlik arşivlendi');
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
    <MallRequiredStates title="Etkinlikler" status={mallCtx}>
    <PageContainer>
      <PageHeader
        title="Etkinlikler"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} etkinlik</span>}
        action={<Button variant="primary" onClick={openCreate}>+ Yeni Etkinlik</Button>}
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
        <button type="button" onClick={() => void loadEvents()} style={inputStyle}>
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
          <h3 style={{ marginTop: 0 }}>{editing ? 'Etkinliği düzenle' : 'Yeni etkinlik'}</h3>
          {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <div>
              <label style={labelStyle}>Slug (boşsa başlıktan üretilir)</label>
              <input
                style={inputStyle}
                value={form.slug}
                onChange={(e) => {
                  setForm({ ...form, slug: e.target.value });
                  setEventFormDirty(true);
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
                    setEventFormDirty(true);
                  }}
                />
                Tüm diller için aynı kapak görseli
              </label>
            </div>
            {form.sameImageForAllLocales ? (
              <div>
                <ContextualMediaPicker
                  context="EVENT_COVER"
                  value={form.sharedCoverImageId}
                  mallId={mallId}
                  onChange={(id) => {
                    setForm({ ...form, sharedCoverImageId: id });
                    setEventFormDirty(true);
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
                    setEventFormDirty(true);
                  }}
                />
              </div>
            ) : (
              tenantLocales.filter((l) => l.isActive).length > 0 &&
              contentLocaleTab && (
                <ContextualMediaPicker
                  context="EVENT_COVER"
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
                      setEventFormDirty(true);
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
                    setEventFormDirty(true);
                  }}
                />
              )
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <ContentChannelFields
                channels={form.channels}
                onChange={(channels) => {
                  setForm({ ...form, channels });
                  setEventFormDirty(true);
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
                  setEventFormDirty(true);
                }}
                onPublishAtChange={(publishStartAt) => {
                  setForm({ ...form, publishStartAt });
                  setEventFormDirty(true);
                }}
                onUnpublishAtChange={(publishEndAt) => {
                  setForm({ ...form, publishEndAt });
                  setEventFormDirty(true);
                }}
                labelStyle={labelStyle}
                inputStyle={inputStyle}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label style={labelStyle}>Etkinlik başlangıcı</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.eventStartAt}
                  onChange={(e) => {
                    setForm({ ...form, eventStartAt: e.target.value });
                    setEventFormDirty(true);
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Etkinlik bitişi</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.eventEndAt}
                  onChange={(e) => {
                    setForm({ ...form, eventEndAt: e.target.value });
                    setEventFormDirty(true);
                  }}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Konum</label>
              <input
                style={inputStyle}
                value={form.location}
                onChange={(e) => {
                  setForm({ ...form, location: e.target.value });
                  setEventFormDirty(true);
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Kategori</label>
              <input
                style={inputStyle}
                value={form.category}
                onChange={(e) => {
                  setForm({ ...form, category: e.target.value });
                  setEventFormDirty(true);
                }}
              />
            </div>
            {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
              <MultilingualContentFields
                locales={tenantLocales}
                activeLocaleId={contentLocaleTab}
                onTabChange={(id) => setContentLocaleTab(id)}
                defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                getValue={(localeId, field) => {
                  const defId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defId && localeId === defId) {
                    return String(form[field as keyof FormState] ?? '');
                  }
                  return localeDrafts[localeId]?.[field] ?? '';
                }}
                setValue={(localeId, field, v) => {
                  const defId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defId && localeId === defId) {
                    setForm((prev) => ({ ...prev, [field]: v }));
                    setEventFormDirty(true);
                    return;
                  }
                  setLocaleDrafts((d) => ({
                    ...d,
                    [localeId]: { ...d[localeId], [field]: v },
                  }));
                  setI18nDirty(true);
                }}
                onCopyFromDefault={(targetId) => {
                  setLocaleDrafts((d) => ({
                    ...d,
                    [targetId]: {
                      title: form.title,
                      shortDescription: form.shortDescription,
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
                <div>
                  <label style={labelStyle}>Başlık *</label>
                  <input
                    style={inputStyle}
                    value={form.title}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      setEventFormDirty(true);
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
                      setEventFormDirty(true);
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
                      setEventFormDirty(true);
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
                      setEventFormDirty(true);
                    }}
                  />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Link URL</label>
              <input
                style={inputStyle}
                value={form.linkUrl}
                onChange={(e) => {
                  setForm({ ...form, linkUrl: e.target.value });
                  setEventFormDirty(true);
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
                  setEventFormDirty(true);
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
                  setEventFormDirty(true);
                }}
                placeholder='{"sponsor":"..."}'
              />
            </div>
            {editing && (
              <LinkedSliderGroupsSection
                entityType="EVENT"
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
            <th style={{ padding: 8 }}>Kanallar</th>
            <th style={{ padding: 8 }}>Durum</th>
            <th style={{ padding: 8 }}>Tarih</th>
            <th style={{ padding: 8 }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 8 }}>
                <strong>{e.title}</strong>
                <div style={{ color: '#9ca3af', fontSize: 11 }}>{e.slug}</div>
              </td>
              <td style={{ padding: 8, color: '#6b7280', fontSize: 12 }}>{formatChannels(e.channels)}</td>
              <td style={{ padding: 8 }}>
                <StatusBadge status={e.status} />
                {e.status === 'SCHEDULED' && e.publishStartAt && (
                  <div style={{ fontSize: 10, color: '#92400e', marginTop: 4 }}>
                    Yayın: {new Date(e.publishStartAt).toLocaleString('tr-TR')}
                  </div>
                )}
              </td>
              <td style={{ padding: 8, color: '#6b7280' }}>
                {e.eventStartAt ? e.eventStartAt.slice(0, 10) : '—'} → {e.eventEndAt ? e.eventEndAt.slice(0, 10) : '—'}
              </td>
              <td style={{ padding: 8 }}>
                <button type="button" onClick={() => openEdit(e)} style={{ marginRight: 6 }}>
                  Düzenle
                </button>
                {e.status !== 'PUBLISHED' && (
                  <button type="button" onClick={() => void handlePublish(e.id)} style={{ marginRight: 6 }}>
                    Yayınla
                  </button>
                )}
                {e.status !== 'ARCHIVED' && (
                  <button type="button" onClick={() => void handleArchive(e.id)} style={{ marginRight: 6 }}>
                    Arşiv
                  </button>
                )}
                <button type="button" onClick={() => void handleDelete(e.id)}>
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
