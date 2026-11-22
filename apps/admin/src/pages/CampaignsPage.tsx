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
import { CAMPAIGN_I18N_FIELDS, MultilingualContentFields } from '../components/MultilingualContentFields';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { ContentChannelFields } from '../components/ContentChannelFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import { ContentSlugFields } from '../components/ContentSlugFields';
import { contentSlugForPayload, resolveUseCustomSlug, slugify } from '../lib/slugify';
import {
  buildCampaignTranslationsPayload,
  getCampaignSaveBlocker,
} from '../lib/campaign-event-form-validation';
import { DEFAULT_CONTENT_CHANNELS } from '../lib/content-channels';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ListFilterBar } from '../components/ui/ListFilterBar';
import { IconArchive, IconPencil, IconTrash } from '../components/ui/icons';
import { LinkedSliderGroupsSection } from '../components/LinkedSliderGroupsSection';
import {
  apiCampaignArchive,
  apiCampaignCreate,
  apiCampaignDelete,
  apiCampaignPublish,
  apiCampaignUpdate,
  apiCampaignsList,
  apiContentLocales,
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

function storeRowLabel(store: CmsCampaign['store']): string {
  if (!store) return '—';
  const base = store.globalStore.name;
  return store.detailTitle ? `${base} — ${store.detailTitle}` : base;
}

type FormState = {
  title: string;
  slug: string;
  useCustomSlug: boolean;
  shortDescription: string;
  description: string;
  sameImageForAllLocales: boolean;
  sharedCoverImageId: string;
  sharedMobileCoverImageId: string;
  defaultLocaleCoverImageId: string;
  defaultLocaleMobileCoverImageId: string;
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
  useCustomSlug: false,
  shortDescription: '',
  description: '',
  sameImageForAllLocales: true,
  sharedCoverImageId: '',
  sharedMobileCoverImageId: '',
  defaultLocaleCoverImageId: '',
  defaultLocaleMobileCoverImageId: '',
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
    useCustomSlug: resolveUseCustomSlug(c.slug, c.title),
    shortDescription: c.shortDescription ?? '',
    description: c.description ?? '',
    sameImageForAllLocales: c.sameImageForAllLocales ?? true,
    sharedCoverImageId: c.sharedCoverImageId ?? '',
    sharedMobileCoverImageId: c.sharedMobileCoverImageId ?? '',
    defaultLocaleCoverImageId: '',
    defaultLocaleMobileCoverImageId: '',
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
    slug: contentSlugForPayload({ useCustomSlug: f.useCustomSlug, slug: f.slug }),
    shortDescription: f.shortDescription || undefined,
    description: f.description,
    sameImageForAllLocales: f.sameImageForAllLocales,
    sharedCoverImageId: f.sharedCoverImageId || undefined,
    sharedMobileCoverImageId: f.sharedMobileCoverImageId || undefined,
    coverMediaWidthOverride: parseOptionalDimension(f.coverMediaWidthOverride),
    coverMediaHeightOverride: parseOptionalDimension(f.coverMediaHeightOverride),
    publishStartAt: f.publishStartAt ? new Date(f.publishStartAt).toISOString() : undefined,
    publishEndAt: f.publishEndAt ? new Date(f.publishEndAt).toISOString() : undefined,
    campaignStartAt: f.campaignStartAt ? new Date(f.campaignStartAt).toISOString() : undefined,
    campaignEndAt: f.campaignEndAt ? new Date(f.campaignEndAt).toISOString() : undefined,
    terms: f.terms,
    couponCode: f.couponCode || undefined,
    buttonText: f.buttonText || undefined,
    linkUrl: f.linkUrl || undefined,
    storeId: f.storeId || undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
    channels: f.channels.length ? f.channels : undefined,
    translations: buildCampaignTranslationsPayload(tenantLocales, localeDrafts, {
      sameImageForAllLocales: f.sameImageForAllLocales,
      defaultLocaleCoverImageId: f.defaultLocaleCoverImageId,
      defaultLocaleMobileCoverImageId: f.defaultLocaleMobileCoverImageId,
    }),
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
  const [searchInput, setSearchInput] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [page, setPage] = useState(1);
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
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';
  const canUpdate = can('campaign:update');
  const canPublish = can('campaign:publish');
  const canArchive = can('campaign:archive');
  const canDelete = can('campaign:delete');

  const listRequestRef = useRef(0);
  const loadCampaigns = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCampaignsList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      if (requestId !== listRequestRef.current) return;
      setItems(data.campaigns);
      setTotal(data.total);
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Kampanyalar yüklenemedi');
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch, page]);

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
        const locs = await apiContentLocales(accessToken, tenantId, mallId);
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
          const defaultTr = editing.translations?.find((t) => t.localeId === defaultLocale?.id);
          setForm((prev) => ({
            ...prev,
            defaultLocaleCoverImageId: !editing.sameImageForAllLocales
              ? (defaultTr?.coverImageId ?? editing.sharedCoverImageId ?? '')
              : '',
            defaultLocaleMobileCoverImageId: !editing.sameImageForAllLocales
              ? (defaultTr?.mobileCoverImageId ?? editing.sharedMobileCoverImageId ?? '')
              : '',
          }));
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
              mobileCoverImageId: tableTr?.mobileCoverImageId ?? '',
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
  }, [showForm, editing, accessToken, tenantId, mallId]);

  const formDirty = showForm && (i18nDirty || campaignFormDirty);
  useUnsavedChangesGuard('campaign-form', formDirty);

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
    setCampaignFormDirty(false);
    setShowForm(true);
  }

  function openEdit(c: CmsCampaign) {
    if (formDirty && editing?.id !== c.id && !confirmDiscardUnsavedChanges()) return;
    if (formDirty && editing?.id === c.id) {
      scrollFormIntoView(formRef.current);
      return;
    }
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
    const blocker = getCampaignSaveBlocker({
      title: form.title,
      status: form.status,
      publishStartAt: form.publishStartAt,
      campaignStartAt: form.campaignStartAt,
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
      const payload: CreateCampaignPayload = {
        ...formToPayload(form, localeDrafts, tenantLocales),
        dynamicFieldsJson,
      };
      if (editing) {
        const updated = await apiCampaignUpdate(accessToken, tenantId, editing.id, payload, mallId);
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        await flushCampaignTranslations(updated.id);
      } else {
        const created = await apiCampaignCreate(accessToken, tenantId, payload, mallId);
        await flushCampaignTranslations(created.id);
      }
      toast.success(getSaveSuccessMessage('Kampanya', form.status, form.publishStartAt));
      cancelForm();
      void loadCampaigns();
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
      await apiCampaignDelete(accessToken, tenantId, id, mallId);
      toast.success('Kampanya silindi');
      setConfirm(null);
      if (items.length === 1 && page > 1) setPage(page - 1);
      else void loadCampaigns();
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
      const updated = await apiCampaignPublish(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Kampanya yayınlandı');
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
      const updated = await apiCampaignArchive(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Kampanya arşivlendi');
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
    <MallRequiredStates title="Kampanyalar" status={mallCtx}>
    <PageContainer>
      <PageHeader
        title="Kampanyalar"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} kampanya</span>}
        action={<Button variant="primary" onClick={openCreate}>+ Yeni Kampanya</Button>}
      />
    <div style={{ fontSize: 13 }}>
      <ListFilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchLabel="Kampanyalar içinde ara"
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
          <h3 style={{ marginTop: 0 }}>{editing ? 'Kampanyayı düzenle' : 'Yeni kampanya'}</h3>
          <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
            <div ref={basicSectionRef}>
            <FormSection title="Temel bilgiler">
              {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
                <MultilingualContentFields
                  locales={tenantLocales}
                  fields={CAMPAIGN_I18N_FIELDS}
                  richTextFields={['description', 'terms']}
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
                        ...drafts[targetId],
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
                    <RichTextEditor label="Açıklama" value={form.description} disabled={saving} onChange={(value) => { setForm({ ...form, description: value }); setCampaignFormDirty(true); }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Şartlar</label>
                    <RichTextEditor label="Şartlar" value={form.terms} disabled={saving} onChange={(value) => { setForm({ ...form, terms: value }); setCampaignFormDirty(true); }} />
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
                      {s.detailTitle ? ` — ${s.detailTitle}` : ''}
                    </option>
                  ))}
                </select>
              </div>

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
                <label style={labelStyle}>Bağlantı adresi</label>
                <input
                  style={inputStyle}
                  value={form.linkUrl}
                  onChange={(e) => {
                    setForm({ ...form, linkUrl: e.target.value });
                    setCampaignFormDirty(true);
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
                        if (!checked) {
                          return {
                            ...prev,
                            sameImageForAllLocales: false,
                            defaultLocaleCoverImageId:
                              prev.defaultLocaleCoverImageId || prev.sharedCoverImageId,
                            defaultLocaleMobileCoverImageId:
                              prev.defaultLocaleMobileCoverImageId || prev.sharedMobileCoverImageId,
                          };
                        }
                        return { ...prev, sameImageForAllLocales: true, sharedCoverImageId: prev.sharedCoverImageId || prev.defaultLocaleCoverImageId, sharedMobileCoverImageId: prev.sharedMobileCoverImageId || prev.defaultLocaleMobileCoverImageId };
                      });
                      setCampaignFormDirty(true);
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
                    Dil bazlı görsel kullanırsanız her dil için farklı kampanya bannerı yükleyebilirsiniz.
                    <br />
                    Eksik dil görsellerinde varsayılan dil veya ortak görsel kullanılır.
                  </p>
                )}
              </div>

              {form.sameImageForAllLocales && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
                  <ContextualMediaPicker
                    context="CAMPAIGN_COVER"
                    disabled={saving}
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
                  <ContextualMediaPicker
                    context="CAMPAIGN_MOBILE_COVER"
                    disabled={saving}
                    value={form.sharedMobileCoverImageId}
                    mallId={mallId}
                    onChange={(id) => {
                      setForm({ ...form, sharedMobileCoverImageId: id });
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
                          const mobileValue =
                            defId && localeId === defId
                              ? form.defaultLocaleMobileCoverImageId
                              : localeDrafts[localeId]?.mobileCoverImageId ?? '';
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
                              <ContextualMediaPicker
                                context="CAMPAIGN_COVER"
                    disabled={saving}
                                value={coverValue}
                                mallId={mallId}
                                onChange={(mediaId) => {
                                  if (defId && localeId === defId) {
                                    setForm((prev) => ({
                                      ...prev,
                                      defaultLocaleCoverImageId: mediaId,
                                    }));
                                    setCampaignFormDirty(true);
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
                                  setCampaignFormDirty(true);
                                }}
                              />
                              <ContextualMediaPicker
                                context="CAMPAIGN_MOBILE_COVER"
                    disabled={saving}
                                value={mobileValue}
                                mallId={mallId}
                                onChange={(mediaId) => {
                                  if (defId && localeId === defId) {
                                    setForm((prev) => ({
                                      ...prev,
                                      defaultLocaleMobileCoverImageId: mediaId,
                                    }));
                                    setCampaignFormDirty(true);
                                    return;
                                  }
                                  setLocaleDrafts((d) => ({
                                    ...d,
                                    [localeId]: { ...d[localeId], mobileCoverImageId: mediaId },
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
                                  setCampaignFormDirty(true);
                                }}
                              />
                            </div>
                          );
                        }}
                />
              )}

            </FormSection>
            <FormSection title="Kampanya tarihleri" description="Kampanyanın mağazada geçerli olduğu tarihler. Ziyaretçiye gösterilir; içeriğin sitede ne zaman görüneceğini belirlemez (bunu Yayın ayarları belirler).">
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
                  scheduleHint="İçeriğin sitede ne zaman görünüp kaldırılacağını belirler; kampanya tarihlerinden bağımsızdır."
                  labelStyle={labelStyle}
                  inputStyle={inputStyle}
                />
              </div>

              <div>
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
                  setCampaignFormDirty(true);
                }}
                onSlugChange={(slug) => {
                  setForm((prev) => ({ ...prev, slug }));
                  setCampaignFormDirty(true);
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
                    setCampaignFormDirty(true);
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
                    setCampaignFormDirty(true);
                  }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                  Teknik kullanım içindir; boş bırakabilirsiniz.
                </p>
              </div>

            </FormSection>
            {editing && (
              <LinkedSliderGroupsSection
                entityType="CAMPAIGN"
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

      {!loading && !error && items.length === 0 && !showForm && (
        hasFilters ? (
          <EmptyState
            title="Eşleşen kampanya bulunamadı"
            description="Arama metnini veya durum filtresini değiştirin."
            action={<Button onClick={clearFilters}>Filtreleri temizle</Button>}
          />
        ) : (
          <EmptyState
            title="Henüz kampanya yok"
            description="İlk kampanya kaydını oluşturarak başlayın."
            action={
              <Button variant="primary" onClick={openCreate}>
                + Yeni Kampanya
              </Button>
            }
          />
        )
      )}

      {items.length > 0 && (
      <div className="cms-data-table-wrap">
      <table className="cms-data-table">
        <thead>
          <tr>
            <th>Başlık</th>
            <th>Mağaza</th>
            <th>Durum</th>
            <th style={{ textAlign: 'right' }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const busy = actionBusyId === c.id;
            const canShowPublish = canPublish && (c.status === 'DRAFT' || c.status === 'SCHEDULED');
            const canShowArchive = canArchive && c.status !== 'ARCHIVED';
            return (
            <tr key={c.id}>
              <td>
                <strong style={{ color: '#111827' }}>{c.title}</strong>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{c.slug}</div>
              </td>
              <td style={{ color: '#6b7280' }}>
                {storeRowLabel(c.store)}
              </td>
              <td>
                <StatusBadge status={c.status} />
                {c.status === 'SCHEDULED' && c.publishStartAt && (
                  <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
                    Yayın: {new Date(c.publishStartAt).toLocaleString('tr-TR')}
                  </div>
                )}
              </td>
              <td>
                <div className="cms-data-table__actions">
                  {canUpdate && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => openEdit(c)}
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
                      onClick={() => void handlePublish(c.id)}
                    >
                      Yayınla
                    </Button>
                  )}
                  {canShowArchive && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirm({ kind: 'archive', id: c.id, title: c.title })}
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
                      onClick={() => setConfirm({ kind: 'delete', id: c.id, title: c.title })}
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
        itemLabel="kampanya"
        disabled={loading || Boolean(actionBusyId)}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'delete' ? 'Kampanyayı sil' : 'Kampanyayı arşivle'}
        description={
          confirm?.kind === 'delete'
            ? `"${confirm.title}" kampanyasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`
            : `"${confirm?.title ?? ''}" kampanyasını arşivlemek istediğinizden emin misiniz? Ziyaretçi tarafında görünmez olur.`
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
