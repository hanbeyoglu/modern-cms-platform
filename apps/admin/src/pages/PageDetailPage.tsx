import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MultilingualContentFields, PAGE_I18N_FIELDS } from '../components/MultilingualContentFields';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { validatePageSchedule } from '../lib/publishing-workflow';
import { AuditTimeline } from '../components/AuditTimeline';
import { useAuth } from '../auth/useAuth';
import {
  apiLocalesList,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  apiMediaList,
  API_MAX_PAGE_SIZE,
  type CmsLocale,
  type MediaAsset,
} from '../lib/api';
import { usePermission } from '../hooks/usePermission';
import {
  apiPageGet,
  apiPageUpdate,
  apiPageDelete,
  apiPagePublish,
  apiPageArchive,
  apiPageBlocksList,
  apiPageBlockCreate,
  apiPageBlockUpdate,
  apiPageBlockDelete,
  apiPageBlocksReorder,
  type CmsPage,
  type CmsPageBlock,
  type PageStatus,
  type PageType,
  type PageBlockStatus,
  type CmsPageAttachment,
} from '../lib/api/pages';

const STATUS_LABELS: Record<PageStatus, string> = {
  DRAFT: 'Taslak',
  SCHEDULED: 'Zamanlanmış',
  PUBLISHED: 'Yayında',
  ARCHIVED: 'Arşiv',
};

const STATUS_COLORS: Record<PageStatus, string> = {
  DRAFT: '#6b7280',
  SCHEDULED: '#d97706',
  PUBLISHED: '#16a34a',
  ARCHIVED: '#9ca3af',
};

const TYPE_LABELS: Record<PageType, string> = {
  ABOUT: 'Hakkımızda',
  KVKK: 'KVKK',
  PRIVACY_POLICY: 'Gizlilik Politikası',
  COOKIE_POLICY: 'Çerez Politikası',
  TERMS_OF_USE: 'Kullanım Şartları',
  CONTACT_INFO: 'İletişim Bilgileri',
  FAQ: 'SSS',
  TRANSPORTATION: 'Ulaşım',
  CERTIFICATES: 'Sertifikalar',
  DOCUMENTS: 'Belgeler',
  AWARDS: 'Ödüller',
  CUSTOM: 'Özel',
};

const BLOCK_TYPES = [
  'hero',
  'rich-text',
  'image',
  'gallery',
  'video',
  'cta',
  'faq',
  'map',
  'store-list',
  'event-list',
  'campaign-list',
  'custom-html',
] as const;

const BLOCK_TYPE_LABELS: Record<string, string> = {
  'hero': 'Hero Banner',
  'rich-text': 'Zengin Metin',
  'image': 'Resim',
  'gallery': 'Galeri',
  'video': 'Video',
  'cta': 'Call to Action',
  'faq': 'SSS',
  'map': 'Harita',
  'store-list': 'Mağaza Listesi',
  'event-list': 'Etkinlik Listesi',
  'campaign-list': 'Kampanya Listesi',
  'custom-html': 'Özel HTML',
};

const DEFAULT_DATA: Record<string, Record<string, unknown>> = {
  'hero': { title: '', subtitle: '', mediaId: '', buttonText: '', linkUrl: '' },
  'rich-text': { html: '' },
  'image': { mediaId: '' },
  'gallery': { mediaIds: [] },
  'video': { url: '', mediaId: '' },
  'cta': { title: '', buttonText: '', linkUrl: '' },
  'faq': { items: [{ question: '', answer: '' }] },
  'map': { address: '', latitude: null, longitude: null },
  'store-list': { categoryId: '', featuredOnly: false },
  'event-list': { category: '', limit: 10 },
  'campaign-list': { storeId: '', limit: 10 },
  'custom-html': { html: '' },
};

type PageFormState = {
  title: string;
  slug: string;
  type: PageType;
  customTypeLabel: string;
  contentHtml: string;
  status: PageStatus;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  publishAt: string;
  unpublishAt: string;
  attachments: AttachmentFormState[];
};

type AttachmentFormState = {
  title: string;
  description: string;
  mediaId: string;
  sortOrder: number;
  downloadable: boolean;
};

type BlockFormState = {
  type: string;
  title: string;
  dataJson: string;
  status: PageBlockStatus;
};

const EMPTY_BLOCK_FORM: BlockFormState = {
  type: 'rich-text',
  title: '',
  dataJson: JSON.stringify({ html: '' }, null, 2),
  status: 'ACTIVE',
};

function pageAttachmentsToForm(attachments: CmsPageAttachment[]): AttachmentFormState[] {
  return attachments.map((attachment, index) => ({
    title: attachment.title ?? '',
    description: attachment.description ?? '',
    mediaId: attachment.mediaId,
    sortOrder: attachment.sortOrder ?? index * 10,
    downloadable: attachment.downloadable,
  }));
}

function isDocumentAttachmentCandidate(asset: MediaAsset): boolean {
  return (
    asset.mimeType === 'application/pdf' ||
    asset.mimeType.startsWith('image/') ||
    asset.mimeType.includes('word') ||
    asset.mimeType.includes('excel') ||
    asset.mimeType.includes('powerpoint') ||
    asset.mimeType.includes('officedocument') ||
    asset.mimeType === 'text/plain'
  );
}

export function PageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [page, setPage] = useState<CmsPage | null>(null);
  const [blocks, setBlocks] = useState<CmsPageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Page edit form
  const [pageForm, setPageForm] = useState<PageFormState | null>(null);
  const [savingPage, setSavingPage] = useState(false);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);
  const [pageFormDirty, setPageFormDirty] = useState(false);

  // Block form
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState<BlockFormState>(EMPTY_BLOCK_FORM);
  const [savingBlock, setSavingBlock] = useState(false);

  const [deleteBlockConfirmId, setDeleteBlockConfirmId] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!accessToken || !activeTenantId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, b, media] = await Promise.all([
        apiPageGet(accessToken, activeTenantId, id, activeMallId ?? undefined),
        apiPageBlocksList(accessToken, activeTenantId, id, activeMallId ?? undefined),
        apiMediaList(accessToken, activeTenantId, {
          limit: API_MAX_PAGE_SIZE,
          mallId: activeMallId ?? undefined,
        }),
      ]);
      setPage(p);
      setBlocks(b);
      setMediaAssets(media.assets);
      setPageForm({
        title: p.title,
        slug: p.slug,
        type: p.type,
        customTypeLabel: p.customTypeLabel ?? '',
        contentHtml: p.contentHtml ?? '',
        status: p.status,
        seoTitle: p.seoTitle ?? '',
        seoDescription: p.seoDescription ?? '',
        seoKeywords: p.seoKeywords ?? '',
        publishAt: p.publishAt ? p.publishAt.slice(0, 16) : '',
        unpublishAt: p.unpublishAt ? p.unpublishAt.slice(0, 16) : '',
        attachments: pageAttachmentsToForm(p.attachments),
      });
      setPageFormDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, activeMallId, id]);

  useEffect(() => { void loadPage(); }, [loadPage]);

  useEffect(() => {
    const pageId = page?.id;
    if (!accessToken || !activeTenantId || !id || !pageId) {
      setTenantLocales([]);
      setContentLocaleTab(null);
      setLocaleDrafts({});
      return;
    }
    void (async () => {
      try {
        const locs = await apiLocalesList(accessToken, activeTenantId);
        setTenantLocales(locs);
        const activeLocales = locs.filter((l) => l.isActive);
        const defaultLocale = locs.find((l) => l.isDefault);
        setContentLocaleTab((prev) => {
          if (prev && activeLocales.some((l) => l.id === prev)) return prev;
          return defaultLocale?.id ?? activeLocales[0]?.id ?? null;
        });
        const translations = await apiTranslationsList(accessToken, activeTenantId, {
          entityType: 'PAGE',
          entityId: id,
        });
        const drafts: Record<string, Record<string, string>> = {};
        for (const loc of activeLocales) {
          if (loc.id === defaultLocale?.id) continue;
          drafts[loc.id] = {
            title: '',
            seoTitle: '',
            seoDescription: '',
          };
          for (const field of PAGE_I18N_FIELDS) {
            drafts[loc.id][field] =
              translations.find((row) => row.localeId === loc.id && row.field === field)?.value ?? '';
          }
        }
        setLocaleDrafts(drafts);
        setI18nDirty(false);
      } catch {
        setTenantLocales([]);
        setLocaleDrafts({});
      }
    })();
  }, [accessToken, activeTenantId, id, page?.id]);

  useEffect(() => {
    if (!page || (!i18nDirty && !pageFormDirty)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [page, i18nDirty, pageFormDirty]);

  const flushPageTranslations = useCallback(
    async (pageId: string) => {
      if (!accessToken || !activeTenantId || !can('translation:create')) return;
      const defaultLocale = tenantLocales.find((l) => l.isDefault);
      const translations = await apiTranslationsList(accessToken, activeTenantId, {
        entityType: 'PAGE',
        entityId: pageId,
      });
      const idByKey = new Map(translations.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
      for (const loc of tenantLocales.filter((l) => l.isActive)) {
        if (!defaultLocale || loc.id === defaultLocale.id) continue;
        const slice = localeDrafts[loc.id] ?? {};
        for (const field of PAGE_I18N_FIELDS) {
          const value = (slice[field] ?? '').trim();
          const prevId = idByKey.get(`${loc.id}:${field}`);
          if (!value) {
            if (prevId && can('translation:delete')) {
              await apiTranslationDelete(accessToken, activeTenantId, prevId);
            }
            continue;
          }
          await apiTranslationUpsert(accessToken, activeTenantId, {
            localeCode: loc.code,
            entityType: 'PAGE',
            entityId: pageId,
            field,
            value,
          });
        }
      }
    },
    [accessToken, activeTenantId, tenantLocales, localeDrafts, can],
  );

  async function handleSavePage() {
    if (!accessToken || !activeTenantId || !id || !pageForm) return;
    if (!pageForm.title.trim()) { toast.error('Başlık zorunludur'); return; }
    if (pageForm.type === 'CUSTOM' && !pageForm.customTypeLabel.trim()) {
      toast.error('Özel sayfa etiketi zorunludur');
      return;
    }
    if (pageForm.attachments.some((attachment) => !attachment.mediaId)) {
      toast.error('Her doküman eki için medya seçilmelidir');
      return;
    }
    const scheduleError = validatePageSchedule(pageForm.status, pageForm.publishAt);
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    setSavingPage(true);
    try {
      const updated = await apiPageUpdate(accessToken, activeTenantId, id, {
        title: pageForm.title,
        slug: pageForm.slug || undefined,
        type: pageForm.type,
        customTypeLabel: pageForm.type === 'CUSTOM' ? pageForm.customTypeLabel : undefined,
        contentHtml: pageForm.contentHtml,
        status: pageForm.status,
        seoTitle: pageForm.seoTitle || undefined,
        seoDescription: pageForm.seoDescription || undefined,
        seoKeywords: pageForm.seoKeywords || undefined,
        publishAt: pageForm.publishAt ? new Date(pageForm.publishAt).toISOString() : undefined,
        unpublishAt: pageForm.unpublishAt ? new Date(pageForm.unpublishAt).toISOString() : undefined,
        attachments: pageForm.attachments.map((attachment, index) => ({
          title: attachment.title || undefined,
          description: attachment.description || undefined,
          mediaId: attachment.mediaId,
          sortOrder: index * 10,
          downloadable: attachment.downloadable,
        })),
      }, activeMallId ?? undefined);
      await flushPageTranslations(updated.id);
      setPageFormDirty(false);
      setI18nDirty(false);
      toast.success('Sayfa güncellendi');
      void loadPage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSavingPage(false);
    }
  }

  async function handlePublish() {
    if (!accessToken || !activeTenantId || !id) return;
    try {
      await apiPagePublish(accessToken, activeTenantId, id, activeMallId ?? undefined);
      toast.success('Sayfa yayınlandı');
      void loadPage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlanamadı');
    }
  }

  async function handleArchive() {
    if (!accessToken || !activeTenantId || !id) return;
    try {
      await apiPageArchive(accessToken, activeTenantId, id, activeMallId ?? undefined);
      toast.success('Sayfa arşivlendi');
      void loadPage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arşivlenemedi');
    }
  }

  async function handleDeletePage() {
    if (!accessToken || !activeTenantId || !id) return;
    try {
      await apiPageDelete(accessToken, activeTenantId, id, activeMallId ?? undefined);
      toast.success('Sayfa silindi');
      navigate('/pages');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  }

  function openBlockCreate() {
    setEditingBlockId(null);
    setBlockForm({ ...EMPTY_BLOCK_FORM });
    setShowBlockForm(true);
  }

  function openBlockEdit(block: CmsPageBlock) {
    setEditingBlockId(block.id);
    setBlockForm({
      type: block.type,
      title: block.title ?? '',
      dataJson: JSON.stringify(block.dataJson, null, 2),
      status: block.status,
    });
    setShowBlockForm(true);
  }

  function handleBlockTypeChange(type: string) {
    setBlockForm((f) => ({
      ...f,
      type,
      dataJson: JSON.stringify(DEFAULT_DATA[type] ?? {}, null, 2),
    }));
  }

  async function handleSaveBlock() {
    if (!accessToken || !activeTenantId || !id) return;
    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(blockForm.dataJson) as Record<string, unknown>;
    } catch {
      toast.error('Blok verisi geçerli JSON değil');
      return;
    }
    setSavingBlock(true);
    try {
      if (editingBlockId) {
        await apiPageBlockUpdate(accessToken, activeTenantId, id, editingBlockId, {
          type: blockForm.type,
          title: blockForm.title || undefined,
          dataJson: parsedData,
          status: blockForm.status,
        }, activeMallId ?? undefined);
        toast.success('Blok güncellendi');
      } else {
        const sortOrder = blocks.length > 0 ? Math.max(...blocks.map((b) => b.sortOrder)) + 10 : 0;
        await apiPageBlockCreate(accessToken, activeTenantId, id, {
          type: blockForm.type,
          title: blockForm.title || undefined,
          dataJson: parsedData,
          sortOrder,
          status: blockForm.status,
        }, activeMallId ?? undefined);
        toast.success('Blok eklendi');
      }
      setShowBlockForm(false);
      setEditingBlockId(null);
      void loadPage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSavingBlock(false);
    }
  }

  async function handleDeleteBlock(blockId: string) {
    if (!accessToken || !activeTenantId || !id) return;
    try {
      await apiPageBlockDelete(accessToken, activeTenantId, id, blockId, activeMallId ?? undefined);
      toast.success('Blok silindi');
      setDeleteBlockConfirmId(null);
      void loadPage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  }

  async function handleMoveBlock(blockId: string, direction: 'up' | 'down') {
    if (!accessToken || !activeTenantId || !id) return;
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === blocks.length - 1) return;

    const reordered = [...blocks];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    const payload = reordered.map((b, i) => ({ id: b.id, sortOrder: i * 10 }));
    try {
      const updated = await apiPageBlocksReorder(accessToken, activeTenantId, id, { blocks: payload }, activeMallId ?? undefined);
      setBlocks(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıralanamadı');
    }
  }

  function updateAttachment(index: number, patch: Partial<AttachmentFormState>) {
    setPageForm((form) => {
      if (!form) return form;
      return {
        ...form,
        attachments: form.attachments.map((attachment, i) =>
          i === index ? { ...attachment, ...patch } : attachment,
        ),
      };
    });
    setPageFormDirty(true);
  }

  function addAttachment() {
    setPageForm((form) =>
      form
        ? {
            ...form,
            attachments: [
              ...form.attachments,
              {
                title: '',
                description: '',
                mediaId: '',
                sortOrder: form.attachments.length * 10,
                downloadable: true,
              },
            ],
          }
        : form,
    );
    setPageFormDirty(true);
  }

  function removeAttachment(index: number) {
    setPageForm((form) =>
      form ? { ...form, attachments: form.attachments.filter((_, i) => i !== index) } : form,
    );
    setPageFormDirty(true);
  }

  function moveAttachment(index: number, direction: 'up' | 'down') {
    setPageForm((form) => {
      if (!form) return form;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= form.attachments.length) return form;
      const reordered = [...form.attachments];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return {
        ...form,
        attachments: reordered.map((attachment, i) => ({ ...attachment, sortOrder: i * 10 })),
      };
    });
    setPageFormDirty(true);
  }

  if (loading) return <div style={{ padding: 32, color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>;
  if (error) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</div>
      <button onClick={() => navigate('/pages')} style={btnStyle('#6b7280')}>← Geri</button>
    </div>
  );
  if (!page || !pageForm) return null;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/pages')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>
          ← Sayfalar
        </button>
        <span style={{ color: '#d1d5db' }}>|</span>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{page.title}</h1>
        <span style={badgeStyle(STATUS_COLORS[page.status] + '22', STATUS_COLORS[page.status])}>
          {STATUS_LABELS[page.status]}
        </span>
        {page.status === 'SCHEDULED' && page.publishAt && (
          <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>
            Yayın: {new Date(page.publishAt).toLocaleString('tr-TR')}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {page.status !== 'PUBLISHED' && page.status !== 'ARCHIVED' && (
          <button onClick={handlePublish} style={btnStyle('#16a34a')}>Yayınla</button>
        )}
        {page.status !== 'ARCHIVED' && (
          <button onClick={handleArchive} style={btnStyle('#6b7280')}>Arşivle</button>
        )}
        <button onClick={handleDeletePage} style={btnStyle('#dc2626')}>Sayfayı Sil</button>
      </div>

      {/* Page metadata form */}
      <div style={cardStyle({ marginBottom: 24 })}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Sayfa Bilgileri</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
              <MultilingualContentFields
                locales={tenantLocales}
                fields={PAGE_I18N_FIELDS}
                activeLocaleId={contentLocaleTab}
                onTabChange={(localeId) => setContentLocaleTab(localeId)}
                defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                getValue={(localeId, field) => {
                  const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defaultLocaleId && localeId === defaultLocaleId) {
                    return String(pageForm[field as keyof PageFormState] ?? '');
                  }
                  return localeDrafts[localeId]?.[field] ?? '';
                }}
                setValue={(localeId, field, value) => {
                  const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defaultLocaleId && localeId === defaultLocaleId) {
                    setPageForm((f) => f && { ...f, [field]: value });
                    setPageFormDirty(true);
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
                      title: pageForm.title,
                      customTypeLabel: pageForm.customTypeLabel,
                      contentHtml: pageForm.contentHtml,
                      seoTitle: pageForm.seoTitle,
                      seoDescription: pageForm.seoDescription,
                    },
                  }));
                  setI18nDirty(true);
                }}
                disabled={savingPage}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Başlık *</label>
                  <input
                    value={pageForm.title}
                    onChange={(e) => {
                      setPageForm((f) => f && { ...f, title: e.target.value });
                      setPageFormDirty(true);
                    }}
                    style={inputStyle({ width: '100%' })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SEO Başlığı</label>
                  <input
                    value={pageForm.seoTitle}
                    onChange={(e) => {
                      setPageForm((f) => f && { ...f, seoTitle: e.target.value });
                      setPageFormDirty(true);
                    }}
                    style={inputStyle({ width: '100%' })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>SEO Açıklaması</label>
                  <input
                    value={pageForm.seoDescription}
                    onChange={(e) => {
                      setPageForm((f) => f && { ...f, seoDescription: e.target.value });
                      setPageFormDirty(true);
                    }}
                    style={inputStyle({ width: '100%' })}
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Slug</label>
            <input
              value={pageForm.slug}
              onChange={(e) => {
                setPageForm((f) => f && { ...f, slug: e.target.value });
                setPageFormDirty(true);
              }}
              style={inputStyle({ width: '100%', fontFamily: 'monospace', fontSize: 12 })}
            />
          </div>
          <div>
            <label style={labelStyle}>Tip</label>
            <select
              value={pageForm.type}
              onChange={(e) => {
                setPageForm((f) => f && { ...f, type: e.target.value as PageType });
                setPageFormDirty(true);
              }}
              style={inputStyle({ width: '100%' })}
            >
              {(Object.keys(TYPE_LABELS) as PageType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {pageForm.type === 'CUSTOM' && (
            <div>
              <label style={labelStyle}>Özel Tip Etiketi *</label>
              <input
                value={pageForm.customTypeLabel}
                onChange={(e) => {
                  setPageForm((f) => f && { ...f, customTypeLabel: e.target.value });
                  setPageFormDirty(true);
                }}
                style={inputStyle({ width: '100%' })}
                placeholder="Diplomamız"
              />
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <PublishingWorkflowFields
              mode="page"
              status={pageForm.status}
              publishAt={pageForm.publishAt}
              unpublishAt={pageForm.unpublishAt}
              onStatusChange={(status) => {
                setPageForm((f) => f && { ...f, status });
                setPageFormDirty(true);
              }}
              onPublishAtChange={(publishAt) => {
                setPageForm((f) => f && { ...f, publishAt });
                setPageFormDirty(true);
              }}
              onUnpublishAtChange={(unpublishAt) => {
                setPageForm((f) => f && { ...f, unpublishAt });
                setPageFormDirty(true);
              }}
              labelStyle={labelStyle}
              inputStyle={inputStyle()}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>İçerik HTML</label>
            <textarea
              value={pageForm.contentHtml}
              onChange={(e) => {
                setPageForm((f) => f && { ...f, contentHtml: e.target.value });
                setPageFormDirty(true);
              }}
              rows={8}
              style={{ ...inputStyle({ width: '100%' }), fontFamily: 'monospace', resize: 'vertical' }}
              placeholder="<p>Sayfa içeriği...</p>"
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ ...labelStyle, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>SEO</label>
          </div>
          <div>
            <label style={labelStyle}>SEO Anahtar Kelimeler</label>
            <input
              value={pageForm.seoKeywords}
              onChange={(e) => {
                setPageForm((f) => f && { ...f, seoKeywords: e.target.value });
                setPageFormDirty(true);
              }}
              style={inputStyle({ width: '100%' })}
              placeholder="kelime1, kelime2"
            />
          </div>
        </div>
        <button onClick={handleSavePage} disabled={savingPage} style={{ ...btnStyle('#2563eb'), marginTop: 16 }}>
          {savingPage ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      {/* Document attachments */}
      <div style={cardStyle({ marginBottom: 24 })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Doküman Ekleri ({pageForm.attachments.length})</h3>
          <button onClick={addAttachment} style={btnStyle('#2563eb')}>+ Doküman Ekle</button>
        </div>

        {pageForm.attachments.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 18 }}>
            PDF veya doküman eki yok.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {pageForm.attachments.map((attachment, index) => (
              <div key={`${attachment.mediaId}-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Medya / PDF *</label>
                    <select
                      value={attachment.mediaId}
                      onChange={(e) => updateAttachment(index, { mediaId: e.target.value })}
                      style={inputStyle({ width: '100%' })}
                    >
                      <option value="">Medya seç</option>
                      {mediaAssets
                        .filter(isDocumentAttachmentCandidate)
                        .map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.originalName} · {asset.mimeType}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Başlık</label>
                    <input
                      value={attachment.title}
                      onChange={(e) => updateAttachment(index, { title: e.target.value })}
                      style={inputStyle({ width: '100%' })}
                      placeholder="Kalite Belgesi"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Açıklama</label>
                    <textarea
                      value={attachment.description}
                      onChange={(e) => updateAttachment(index, { description: e.target.value })}
                      rows={2}
                      style={{ ...inputStyle({ width: '100%' }), resize: 'vertical' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={attachment.downloadable}
                      onChange={(e) => updateAttachment(index, { downloadable: e.target.checked })}
                    />
                    İndirilebilir
                  </label>
                  <button onClick={() => moveAttachment(index, 'up')} disabled={index === 0} style={smallBtn('#6b7280')}>Yukarı</button>
                  <button onClick={() => moveAttachment(index, 'down')} disabled={index === pageForm.attachments.length - 1} style={smallBtn('#6b7280')}>Aşağı</button>
                  <button onClick={() => removeAttachment(index)} style={smallBtn('#dc2626')}>Kaldır</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocks section */}
      <div style={cardStyle()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>İçerik Blokları ({blocks.length})</h3>
          <button onClick={openBlockCreate} style={btnStyle('#2563eb')}>+ Blok Ekle</button>
        </div>

        {/* Block form */}
        {showBlockForm && (
          <div style={{ border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, marginBottom: 16, background: '#eff6ff' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>
              {editingBlockId ? 'Blok Düzenle' : 'Yeni Blok'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Blok Tipi *</label>
                <select
                  value={blockForm.type}
                  onChange={(e) => handleBlockTypeChange(e.target.value)}
                  style={inputStyle({ width: '100%' })}
                >
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>{BLOCK_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Başlık (opsiyonel)</label>
                <input
                  value={blockForm.title}
                  onChange={(e) => setBlockForm((f) => ({ ...f, title: e.target.value }))}
                  style={inputStyle({ width: '100%' })}
                  placeholder="Blok başlığı"
                />
              </div>
              <div>
                <label style={labelStyle}>Durum</label>
                <select
                  value={blockForm.status}
                  onChange={(e) => setBlockForm((f) => ({ ...f, status: e.target.value as PageBlockStatus }))}
                  style={inputStyle({ width: '100%' })}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="PASSIVE">Pasif</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Blok Verisi (JSON)</label>
              <textarea
                value={blockForm.dataJson}
                onChange={(e) => setBlockForm((f) => ({ ...f, dataJson: e.target.value }))}
                rows={8}
                style={{ ...inputStyle({ width: '100%' }), fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={handleSaveBlock} disabled={savingBlock} style={btnStyle('#16a34a')}>
                {savingBlock ? 'Kaydediliyor…' : editingBlockId ? 'Güncelle' : 'Ekle'}
              </button>
              <button onClick={() => { setShowBlockForm(false); setEditingBlockId(null); }} style={btnStyle('#6b7280')}>
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Block list */}
        {blocks.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Henüz blok eklenmemiş.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blocks.map((block, idx) => (
              <div
                key={block.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: '10px 14px',
                  background: block.status === 'PASSIVE' ? '#f9fafb' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: block.status === 'PASSIVE' ? 0.6 : 1,
                }}
              >
                {/* Sort order controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    onClick={() => handleMoveBlock(block.id, 'up')}
                    disabled={idx === 0}
                    style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 3, cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 10, padding: '1px 5px', opacity: idx === 0 ? 0.3 : 1 }}
                  >▲</button>
                  <button
                    onClick={() => handleMoveBlock(block.id, 'down')}
                    disabled={idx === blocks.length - 1}
                    style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 3, cursor: idx === blocks.length - 1 ? 'not-allowed' : 'pointer', fontSize: 10, padding: '1px 5px', opacity: idx === blocks.length - 1 ? 0.3 : 1 }}
                  >▼</button>
                </div>

                {/* Block info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f3f4f6', padding: '2px 6px', borderRadius: 3, color: '#374151' }}>
                      {block.type}
                    </span>
                    {block.title && (
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{block.title}</span>
                    )}
                    <span style={badgeStyle(block.status === 'ACTIVE' ? '#dcfce7' : '#f3f4f6', block.status === 'ACTIVE' ? '#16a34a' : '#6b7280')}>
                      {block.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    Sıra: {block.sortOrder} · {BLOCK_TYPE_LABELS[block.type] ?? block.type}
                  </div>
                </div>

                {/* Block actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openBlockEdit(block)} style={smallBtn('#2563eb')}>Düzenle</button>
                  {deleteBlockConfirmId === block.id ? (
                    <>
                      <button onClick={() => handleDeleteBlock(block.id)} style={smallBtn('#dc2626')}>Evet, Sil</button>
                      <button onClick={() => setDeleteBlockConfirmId(null)} style={smallBtn('#6b7280')}>İptal</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteBlockConfirmId(block.id)} style={smallBtn('#dc2626')}>Sil</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '20px 24px',
          marginTop: 24,
          background: '#fff',
        }}
      >
        <AuditTimeline entityType="page" entityId={page.id} />
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  };
}

function smallBtn(color: string): React.CSSProperties {
  return {
    background: 'none',
    border: `1px solid ${color}`,
    borderRadius: 4,
    color,
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };
}

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    ...extra,
  };
}

function cardStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 20,
    background: '#fafafa',
    ...extra,
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
};

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
  };
}
