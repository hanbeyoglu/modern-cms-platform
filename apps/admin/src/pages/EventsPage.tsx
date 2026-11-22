import { LocalizedCoverFields } from '../components/LocalizedCoverFields';
import { RichTextEditor } from '../components/RichTextEditor';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { MultilingualContentFields, EVENT_I18N_FIELDS } from '../components/MultilingualContentFields';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { ContentChannelFields } from '../components/ContentChannelFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import { ContentSlugFields } from '../components/ContentSlugFields';
import { contentSlugForPayload, resolveUseCustomSlug, slugify } from '../lib/slugify';
import {
  buildEventTranslationsPayload,
  getEventSaveBlocker,
} from '../lib/campaign-event-form-validation';
import { DEFAULT_CONTENT_CHANNELS, formatChannels } from '../lib/content-channels';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ListFilterBar } from '../components/ui/ListFilterBar';
import { IconArchive, IconPencil, IconTrash } from '../components/ui/icons';
import { LinkedSliderGroupsSection } from '../components/LinkedSliderGroupsSection';
import {
  apiEventArchive,
  apiEventCreate,
  apiEventDelete,
  apiEventPublish,
  apiEventUpdate,
  apiEventsList,
  apiContentLocales,
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
import { EmptyState } from '../components/ui/EmptyState';
import { FormSection } from '../components/FormSection';
import { ListPagination } from '../components/ListPagination';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { confirmDiscardUnsavedChanges } from '../lib/unsaved-changes';
import { getSaveActionLabel, getSaveSuccessMessage } from '../lib/publishing-workflow';
import { describeSaveError, focusFirstField, scrollFormIntoView } from '../lib/form-focus';

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Aktif (arşiv hariç)' },
  { value: 'DRAFT', label: 'Taslak' },
  { value: 'SCHEDULED', label: 'Zamanlanmış' },
  { value: 'PUBLISHED', label: 'Yayında' },
  { value: 'ARCHIVED', label: 'Arşiv' },
];

const STATUS_STYLE: Record<ContentStatus, { bg: string; color: string; label: string; dot: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak', dot: '#9ca3af' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış', dot: '#f59e0b' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında', dot: '#10b981' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv', dot: '#9ca3af' },
};

function StatusBadge({ status }: { status: ContentStatus }) {
  const c = STATUS_STYLE[status];
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

type FormState = {
  isFree: boolean;
  title: string;
  slug: string;
  useCustomSlug: boolean;
  shortDescription: string;
  description: string;
  sameImageForAllLocales: boolean;
  sharedCoverImageId: string;
  defaultLocaleCoverImageId: string;
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
  isFree: true,
  title: '',
  slug: '',
  useCustomSlug: false,
  shortDescription: '',
  description: '',
  sameImageForAllLocales: true,
  sharedCoverImageId: '',
  defaultLocaleCoverImageId: '',
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
    isFree: e.isFree ?? true,
    title: e.title,
    slug: e.slug,
    useCustomSlug: resolveUseCustomSlug(e.slug, e.title),
    shortDescription: e.shortDescription ?? '',
    description: e.description ?? '',
    sameImageForAllLocales: e.sameImageForAllLocales ?? true,
    sharedCoverImageId: e.sharedCoverImageId ?? '',
    defaultLocaleCoverImageId: '',
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
    isFree: f.isFree,
    title: f.title,
    slug: contentSlugForPayload({ useCustomSlug: f.useCustomSlug, slug: f.slug }),
    shortDescription: f.shortDescription || undefined,
    description: f.description,
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
    translations: buildEventTranslationsPayload(tenantLocales, localeDrafts, {
      sameImageForAllLocales: f.sameImageForAllLocales,
      defaultLocaleCoverImageId: f.defaultLocaleCoverImageId,
    }),
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
  const [searchInput, setSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsEvent | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);
  const [eventFormDirty, setEventFormDirty] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';
  const canUpdate = can('event:update');
  const canPublish = can('event:publish');
  const canArchive = can('event:archive');
  const canDelete = can('event:delete');

  const listRequestRef = useRef(0);
  const loadEvents = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiEventsList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      if (requestId !== listRequestRef.current) return;
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Etkinlikler yüklenemedi');
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch, page]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setFilterSearch((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!showForm || !accessToken || !tenantId) {
      setTenantLocales([]);
      setContentLocaleTab(null);
      setLocaleDrafts({});
      return;
    }
    void (async () => {
      try {
        const locs = await apiContentLocales(accessToken, tenantId, mallId);
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
          const defaultTr = editing.translations?.find((t) => t.localeId === def?.id);
          setForm((prev) => ({
            ...prev,
            defaultLocaleCoverImageId: !editing.sameImageForAllLocales
              ? (defaultTr?.coverImageId ?? editing.sharedCoverImageId ?? '')
              : '',
          }));
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
  }, [showForm, editing, accessToken, tenantId, mallId]);

  const formDirty = showForm && (i18nDirty || eventFormDirty);
  useUnsavedChangesGuard('event-form', formDirty);

  const formRef = useRef<HTMLDivElement>(null);
  const basicSectionRef = useRef<HTMLDivElement>(null);
  const focusPendingRef = useRef(false);

  useEffect(() => {
    if (!showForm) return;
    focusPendingRef.current = true;
    scrollFormIntoView(formRef.current);
  }, [showForm, editing]);

  useEffect(() => {
    if (!showForm || !focusPendingRef.current) return;
    const timer = window.setTimeout(() => {
      focusFirstField(basicSectionRef.current, formRef.current);
      if (contentLocaleTab) focusPendingRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showForm, editing, contentLocaleTab]);

  // A new AVM/tenant scope must never receive a form filled for the previous one.
  const scopeKeyRef = useRef(`${tenantId}:${mallId}`);
  useEffect(() => {
    const key = `${tenantId}:${mallId}`;
    if (scopeKeyRef.current === key) return;
    scopeKeyRef.current = key;
    cancelForm();
    setPage(1);
  }, [tenantId, mallId]);

  // Dashboard quick action: "?new=1" opens the create form once, then the flag is removed.
  const [searchParams, setSearchParams] = useSearchParams();
  const newParamHandledRef = useRef(false);
  useEffect(() => {
    if (newParamHandledRef.current || searchParams.get('new') !== '1' || mallCtx.status !== 'ready') return;
    newParamHandledRef.current = true;
    openCreate();
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, mallCtx.status]);

  function requestCloseForm() {
    if (formDirty && !confirmDiscardUnsavedChanges()) return;
    cancelForm();
  }

  function clearFilters() {
    setSearchInput('');
    setFilterSearch('');
    setFilterStatus('');
    setPage(1);
  }

  function openCreate() {
    if (formDirty && !confirmDiscardUnsavedChanges()) return;
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setLocaleDrafts({});
    setI18nDirty(false);
    setEventFormDirty(false);
    setShowForm(true);
  }

  function openEdit(e: CmsEvent) {
    if (formDirty && editing?.id !== e.id && !confirmDiscardUnsavedChanges()) return;
    if (formDirty && editing?.id === e.id) {
      scrollFormIntoView(formRef.current);
      return;
    }
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
      defaultLocaleCoverImageId: form.defaultLocaleCoverImageId,
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
      } else {
        const created = await apiEventCreate(accessToken, tenantId, payload, mallId);
        eventId = created.id;
        await flushEventTranslations(eventId);
      }
      toast.success(getSaveSuccessMessage('Etkinlik', form.status, form.publishStartAt));
      cancelForm();
      void loadEvents();
    } catch (err) {
      setFormError(describeSaveError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken || !tenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      await apiEventDelete(accessToken, tenantId, id, mallId);
      toast.success('Etkinlik silindi');
      setConfirm(null);
      if (events.length === 1 && page > 1) setPage(page - 1);
      else void loadEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handlePublish(id: string) {
    if (!accessToken || !tenantId || actionBusyId) return;
    setActionBusyId(id);
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
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      const updated = await apiEventArchive(accessToken, tenantId, id, mallId);
      setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Etkinlik arşivlendi');
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Arşivlenemedi');
    } finally {
      setActionBusyId(null);
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

  const hasFilters = Boolean(filterSearch || searchInput.trim() || filterStatus);

  return (
    <MallRequiredStates title="Etkinlikler" status={mallCtx}>
    <PageContainer>
      <PageHeader
        title="Etkinlikler"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} etkinlik</span>}
        action={<Button variant="primary" onClick={openCreate}>+ Yeni Etkinlik</Button>}
      />
    <div style={{ fontSize: 13 }}>
      <ListFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchLabel="Etkinlikler içinde ara"
        statusValue={filterStatus}
        onStatusChange={(value) => {
          setFilterStatus(value as ContentStatus | '');
          setPage(1);
        }}
        statusOptions={STATUS_FILTER_OPTIONS}
        trailing={
          hasFilters ? (
            <Button variant="ghost" onClick={clearFilters}>
              Filtreleri temizle
            </Button>
          ) : null
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading && <LoadingState />}

      {showForm && (
        <div
          ref={formRef}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '16px 16px 0',
            marginBottom: 20,
            background: '#fafafa',
            scrollMarginTop: 16,
          }}
        >
          <h3 style={{ marginTop: 0 }}>{editing ? 'Etkinliği düzenle' : 'Yeni etkinlik'}</h3>
          <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
            <div ref={basicSectionRef}>
            <FormSection title="Temel bilgiler">
              {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
                <MultilingualContentFields
                  locales={tenantLocales}
                  activeLocaleId={contentLocaleTab}
                  onTabChange={(id) => setContentLocaleTab(id)}
                  defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                  fields={EVENT_I18N_FIELDS}
                  richTextFields={['description']}
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
                        ...d[targetId],
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
                    <RichTextEditor label="Açıklama" value={form.description} disabled={saving} onChange={(value) => { setForm({ ...form, description: value }); setEventFormDirty(true); }} />
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
                <label style={labelStyle} htmlFor="event-ticket-pricing">Bilet / katılım ücreti</label>
                <select id="event-ticket-pricing" style={inputStyle} value={form.isFree ? 'FREE' : 'PAID'} disabled={saving} onChange={(e) => {
                  setForm({ ...form, isFree: e.target.value === 'FREE' });
                  setEventFormDirty(true);
                }}>
                  <option value="FREE">Ücretsiz</option>
                  <option value="PAID">Ücretli</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Bağlantı adresi</label>
                <input
                  style={inputStyle}
                  value={form.linkUrl}
                  onChange={(e) => {
                    setForm({ ...form, linkUrl: e.target.value });
                    setEventFormDirty(true);
                  }}
                />
              </div>

            </FormSection>
            </div>
            <FormSection title="Görseller">
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
                    disabled={saving || (form.sameImageForAllLocales && !tenantLocales.some(l => l.isActive && l.isDefault))}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm((prev) => {
                        if (!checked && !prev.defaultLocaleCoverImageId && prev.sharedCoverImageId) {
                          return {
                            ...prev,
                            sameImageForAllLocales: false,
                            defaultLocaleCoverImageId: prev.sharedCoverImageId,
                          };
                        }
                        return { ...prev, sameImageForAllLocales: checked, sharedCoverImageId: checked ? (prev.sharedCoverImageId || prev.defaultLocaleCoverImageId) : prev.sharedCoverImageId };
                      });
                      setEventFormDirty(true);
                    }}
                  />
                  Tüm diller için aynı kapak görselini kullan
                </label>
                {!tenantLocales.some(l => l.isActive && l.isDefault) && (
                  <p role="status" style={{ fontSize: 12, color: '#6b7280' }}>
                    Dil bazlı görseller için dil listesinin yüklenmesi ve aktif bir varsayılan dil tanımlanması gerekir. Ortak kapağı kullanmaya devam edebilirsiniz.
                  </p>
                )}
                {!form.sameImageForAllLocales && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.45 }}>
                    Dil bazlı kapak görseli kullanırsanız, her dil için farklı banner yükleyebilirsiniz.
                    <br />
                    Eksik dil görselinde varsayılan dil veya ortak kapak kullanılır.
                  </p>
                )}
              </div>

              {form.sameImageForAllLocales && (
                <div>
                  <ContextualMediaPicker
                    context="EVENT_COVER"
                    disabled={saving}
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
              )}

              {!form.sameImageForAllLocales && (
                <LocalizedCoverFields
                  locales={tenantLocales}
                  disabled={saving}
                  renderFields={(localeId) => {
                          const defId = tenantLocales.find((l) => l.isDefault)?.id;
                          const coverValue =
                            defId && localeId === defId
                              ? form.defaultLocaleCoverImageId
                              : localeDrafts[localeId]?.coverImageId ?? '';
                          return (
                            <ContextualMediaPicker
                              context="EVENT_COVER"
                    disabled={saving}
                              value={coverValue}
                              mallId={mallId}
                              onChange={(mediaId) => {
                                if (defId && localeId === defId) {
                                  setForm((prev) => ({
                                    ...prev,
                                    defaultLocaleCoverImageId: mediaId,
                                  }));
                                  setEventFormDirty(true);
                                  return;
                                }
                                setLocaleDrafts((d) => ({
                                  ...d,
                                  [localeId]: { ...d[localeId], coverImageId: mediaId },
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
                                  coverMediaWidthOverride: dimensions.width
                                    ? String(dimensions.width)
                                    : '',
                                  coverMediaHeightOverride: dimensions.height
                                    ? String(dimensions.height)
                                    : '',
                                });
                                setEventFormDirty(true);
                              }}
                            />
                          );
                        }}
                />
              )}

            </FormSection>
            <FormSection title="Etkinlik tarihleri" description="Etkinliğin gerçekleşeceği tarih ve saat. Ziyaretçiye gösterilir; içeriğin sitede ne zaman görüneceğini belirlemez (bunu Yayın ayarları belirler).">
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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

            </FormSection>
            <FormSection title="Yayın ayarları">
              <div>
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
                  scheduleHint="İçeriğin sitede ne zaman görünüp kaldırılacağını belirler; etkinlik tarihlerinden bağımsızdır."
                  labelStyle={labelStyle}
                  inputStyle={inputStyle}
                />
              </div>

              <div>
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

            </FormSection>
            <FormSection title="Gelişmiş ayarlar" description="Çoğu durumda değiştirmeniz gerekmez." collapsible>
              <ContentSlugFields
                toggleLabel="URL adını değiştir"
                title={form.title}
                slug={form.slug}
                useCustomSlug={form.useCustomSlug}
                persistedSlug={editing?.slug}
                disabled={saving}
                labelStyle={labelStyle}
                inputStyle={inputStyle}
                onUseCustomSlugChange={(useCustomSlug) => {
                  setForm((prev) => ({
                    ...prev,
                    useCustomSlug,
                    slug: useCustomSlug && !prev.slug.trim() ? slugify(prev.title) : prev.slug,
                  }));
                  setEventFormDirty(true);
                }}
                onSlugChange={(slug) => {
                  setForm((prev) => ({ ...prev, slug }));
                  setEventFormDirty(true);
                }}
              />

              <div>
                <label style={labelStyle}>Sıralama (küçük sayı önce gösterilir)</label>
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={form.sortOrder}
                  onChange={(e) => {
                    setForm({ ...form, sortOrder: e.target.value });
                    setEventFormDirty(true);
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>Ek alanlar (JSON)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 100, fontFamily: 'monospace' }}
                  value={form.dynamicJson}
                  onChange={(e) => {
                    setForm({ ...form, dynamicJson: e.target.value });
                    setEventFormDirty(true);
                  }}
                  placeholder='{"sponsor":"..."}'
                />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                  Teknik kullanım içindir; boş bırakabilirsiniz.
                </p>
              </div>

            </FormSection>
            {editing && (
              <LinkedSliderGroupsSection
                entityType="EVENT"
                entityId={editing.id}
                mallId={mallId}
              />
            )}
          </div>
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              marginTop: 16,
              padding: '12px 0 16px',
              background: '#fafafa',
              borderTop: '1px solid #e5e7eb',
              display: 'grid',
              gap: 8,
            }}
          >
            {formError && (
              <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>
                {formError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                disabled={saving}
                onClick={() => void handleSubmit()}
                style={{ whiteSpace: 'normal', maxWidth: '100%', textAlign: 'left' }}
              >
                {saving ? 'Kaydediliyor…' : getSaveActionLabel(form.status)}
              </Button>
              <Button disabled={saving} onClick={requestCloseForm}>
                İptal
              </Button>
              {formDirty && !saving && (
                <span style={{ fontSize: 12, color: '#b45309' }}>Kaydedilmemiş değişiklikler var</span>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && events.length === 0 && !showForm && (
        hasFilters ? (
          <EmptyState
            title="Eşleşen etkinlik bulunamadı"
            description="Arama metnini veya durum filtresini değiştirin."
            action={<Button onClick={clearFilters}>Filtreleri temizle</Button>}
          />
        ) : (
          <EmptyState
            title="Henüz etkinlik yok"
            description="İlk etkinlik kaydını oluşturarak başlayın."
            action={
              <Button variant="primary" onClick={openCreate}>
                + Yeni Etkinlik
              </Button>
            }
          />
        )
      )}

      {events.length > 0 && (
      <div className="cms-data-table-wrap">
      <table className="cms-data-table">
        <thead>
          <tr>
            <th>Başlık</th>
            <th>Kanallar</th>
            <th>Durum</th>
            <th>Tarih</th>
            <th style={{ textAlign: 'right' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const busy = actionBusyId === e.id;
            const canShowPublish = canPublish && (e.status === 'DRAFT' || e.status === 'SCHEDULED');
            const canShowArchive = canArchive && e.status !== 'ARCHIVED';
            return (
            <tr key={e.id}>
              <td>
                <strong style={{ color: '#111827' }}>{e.title}</strong>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{e.slug}</div>
              </td>
              <td style={{ color: '#6b7280', fontSize: 12 }}>{formatChannels(e.channels)}</td>
              <td>
                <StatusBadge status={e.status} />
                {e.status === 'SCHEDULED' && e.publishStartAt && (
                  <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
                    Yayın: {new Date(e.publishStartAt).toLocaleString('tr-TR')}
                  </div>
                )}
              </td>
              <td style={{ color: '#6b7280' }}>
                {e.eventStartAt ? e.eventStartAt.slice(0, 10) : '—'} → {e.eventEndAt ? e.eventEndAt.slice(0, 10) : '—'}
              </td>
              <td>
                <div className="cms-data-table__actions">
                  {canUpdate && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => openEdit(e)}
                    >
                      <IconPencil />
                      Düzenle
                    </Button>
                  )}
                  {canShowPublish && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handlePublish(e.id)}
                    >
                      Yayınla
                    </Button>
                  )}
                  {canShowArchive && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirm({ kind: 'archive', id: e.id, title: e.title })}
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
                      onClick={() => setConfirm({ kind: 'delete', id: e.id, title: e.title })}
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

      <ListPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        itemLabel="etkinlik"
        disabled={loading || Boolean(actionBusyId)}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'delete' ? 'Etkinliği sil' : 'Etkinliği arşivle'}
        description={
          confirm?.kind === 'delete'
            ? `"${confirm.title}" etkinliğini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`
            : `"${confirm?.title ?? ''}" etkinliğini arşivlemek istediğinizden emin misiniz? Ziyaretçi tarafında görünmez olur.`
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
    </div>
    </PageContainer>
    </MallRequiredStates>
  );
}
