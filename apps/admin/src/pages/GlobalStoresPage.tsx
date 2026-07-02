import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { GLOBAL_STORE_I18N_FIELDS, MultilingualContentFields } from '../components/MultilingualContentFields';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import { ContentSlugFields } from '../components/ContentSlugFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import { SocialLinksEditor } from '../components/SocialLinksEditor';
import { contentSlugForPayload, resolveUseCustomSlug } from '../lib/slugify';
import { parseStoreSocialLinks, validateStoreSocialLinks, type StoreSocialLink } from '../lib/store-social-links';
import {
  apiGlobalStoreCreate,
  apiGlobalStoreDelete,
  apiGlobalStoreUpdate,
  apiGlobalStoresList,
  apiSystemLocalesList,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  type CmsLocale,
  type GlobalStore,
  type StoreStatus,
} from '../lib/api';

const STORE_STATUS: Record<StoreStatus, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: 'Aktif', bg: '#d1fae5', color: '#065f46' },
  PASSIVE: { label: 'Pasif', bg: '#f3f4f6', color: '#374151' },
  ARCHIVED: { label: 'Arşiv', bg: '#e5e7eb', color: '#6b7280' },
};

function StatusBadge({ status }: { status: StoreStatus }) {
  const s = STORE_STATUS[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export function GlobalStoresPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const { can } = usePermission();
  // Global stores are platform-level master data (Option A). Only Super Admin can write.
  const canWrite = user?.isSuperAdmin === true;
  const [items, setItems] = useState<GlobalStore[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<StoreStatus | ''>('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GlobalStore | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoMediaId, setLogoMediaId] = useState('');
  const [formStatus, setFormStatus] = useState<StoreStatus>('ACTIVE');
  const [useCustomSlug, setUseCustomSlug] = useState(false);
  const [socialLinks, setSocialLinks] = useState<StoreSocialLink[]>([]);
  const [duplicateStoreId, setDuplicateStoreId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);

  const tenantId = activeTenantId;

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGlobalStoresList(accessToken, tenantId, {
        search: search || undefined,
        status: filterStatus || undefined,
        limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showForm || !i18nDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [showForm, i18nDirty]);

  useEffect(() => {
    if (!showForm || !accessToken || !tenantId) {
      setTenantLocales([]);
      setContentLocaleTab(null);
      setLocaleDrafts({});
      return;
    }
    void (async () => {
      try {
        const locs = await apiSystemLocalesList(accessToken, tenantId);
        setTenantLocales(locs);
        const activeLocales = locs.filter((l) => l.isActive);
        const defaultLocale = locs.find((l) => l.isDefault);
        setContentLocaleTab((prev) => {
          if (prev && activeLocales.some((l) => l.id === prev)) return prev;
          return defaultLocale?.id ?? activeLocales[0]?.id ?? null;
        });
        if (editing) {
          const translations = await apiTranslationsList(accessToken, tenantId, {
            entityType: 'STORE',
            entityId: editing.id,
          });
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            drafts[loc.id] = { name: '', description: '' };
            for (const field of GLOBAL_STORE_I18N_FIELDS) {
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
  }, [showForm, editing?.id, accessToken, tenantId]);

  const flushGlobalStoreTranslations = useCallback(
    async (storeId: string) => {
      if (!accessToken || !tenantId || !can('translation:create')) return;
      const defaultLocale = tenantLocales.find((l) => l.isDefault);
      const translations = await apiTranslationsList(accessToken, tenantId, {
        entityType: 'STORE',
        entityId: storeId,
      });
      const idByKey = new Map(translations.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
      for (const loc of tenantLocales.filter((l) => l.isActive)) {
        if (!defaultLocale || loc.id === defaultLocale.id) continue;
        const slice = localeDrafts[loc.id] ?? {};
        for (const field of GLOBAL_STORE_I18N_FIELDS) {
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
            entityType: 'STORE',
            entityId: storeId,
            field,
            value,
          });
        }
      }
    },
    [accessToken, tenantId, tenantLocales, localeDrafts, can],
  );

  function openCreate() {
    setEditing(null);
    setName('');
    setSlug('');
    setUseCustomSlug(false);
    setSocialLinks([]);
    setDuplicateStoreId(null);
    setDescription('');
    setWebsiteUrl('');
    setPhone('');
    setEmail('');
    setLogoMediaId('');
    setFormStatus('ACTIVE');
    setLocaleDrafts({});
    setI18nDirty(false);
    setShowForm(true);
  }

  function openEdit(g: GlobalStore) {
    setEditing(g);
    setName(g.name);
    setSlug(g.slug);
    setUseCustomSlug(resolveUseCustomSlug(g.slug, g.name));
    setSocialLinks(parseStoreSocialLinks(g.socialLinksJson));
    setDuplicateStoreId(null);
    setDescription(g.description ?? '');
    setWebsiteUrl(g.websiteUrl ?? '');
    setPhone(g.phone ?? '');
    setEmail(g.email ?? '');
    setLogoMediaId(g.logoMediaId ?? '');
    setFormStatus(g.status);
    setI18nDirty(false);
    setShowForm(true);
  }

  async function save() {
    if (!accessToken || !tenantId || !name.trim()) return;
    const socialErr = validateStoreSocialLinks(socialLinks);
    if (socialErr) {
      setError(socialErr);
      return;
    }
    setSaving(true);
    setDuplicateStoreId(null);
    try {
      const slugPayload = contentSlugForPayload({ useCustomSlug, slug });
      if (editing) {
        const u = await apiGlobalStoreUpdate(accessToken, tenantId, editing.id, {
          name: name.trim(),
          ...(slugPayload !== undefined ? { slug: slugPayload } : {}),
          description: description.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          logoMediaId: logoMediaId || null,
          socialLinks,
          status: formStatus,
        });
        setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        await flushGlobalStoreTranslations(u.id);
      } else {
        const c = await apiGlobalStoreCreate(accessToken, tenantId, {
          name: name.trim(),
          ...(slugPayload !== undefined ? { slug: slugPayload } : {}),
          description: description.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          logoMediaId: logoMediaId || undefined,
          socialLinks,
          status: formStatus,
        });
        setItems((prev) => [c, ...prev]);
        setTotal((t) => t + 1);
        await flushGlobalStoreTranslations(c.id);
      }
      setShowForm(false);
      setLocaleDrafts({});
      setI18nDirty(false);
      toast.success(editing ? 'Mağaza güncellendi' : 'Mağaza oluşturuldu');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Kayıt hatası';
      setError(message);
      if (message.includes('zaten var')) {
        const match = items.find((g) => g.name.toLowerCase() === name.trim().toLowerCase());
        if (match) setDuplicateStoreId(match.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm('Global mağazayı silmek istiyor musunuz?')) return;
    try {
      await apiGlobalStoreDelete(accessToken, tenantId, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      toast.success('Mağaza silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme hatası');
    }
  }

  if (!tenantId) {
    return (
      <PageContainer>
        <PageHeader title="Global Mağazalar" />
        <EmptyState title="Tenant seçilmedi" description="Global mağazalar için üstten bir tenant seçin." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Global Mağazalar"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} mağaza</span>}
        action={canWrite ? <Button variant="primary" onClick={openCreate}>+ Global Mağaza Ekle</Button> : undefined}
      />
    <div style={{ fontSize: 13 }}>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Ada göre ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 5, border: '1px solid #d1d5db', borderRadius: 4, width: 160 }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StoreStatus | '')} style={{ padding: 5, borderRadius: 4 }}>
          <option value="">Tüm durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>
        <button type="button" onClick={() => void load()}>
          Filtrele
        </button>
        <span style={{ color: '#6b7280' }}>{total} kayıt</span>
        {!canWrite && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
            Salt okunur — Global mağaza yönetimi yalnızca Super Admin yetkisine sahiptir
          </span>
        )}
      </div>

      {showForm && canWrite && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{editing ? 'Düzenle' : 'Yeni global mağaza'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 720 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
                <MultilingualContentFields
                  locales={tenantLocales}
                  fields={GLOBAL_STORE_I18N_FIELDS}
                  activeLocaleId={contentLocaleTab}
                  onTabChange={(localeId) => setContentLocaleTab(localeId)}
                  defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                  getValue={(localeId, field) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (defaultLocaleId && localeId === defaultLocaleId) {
                      return field === 'name' ? name : description;
                    }
                    return localeDrafts[localeId]?.[field] ?? '';
                  }}
                  setValue={(localeId, field, value) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (defaultLocaleId && localeId === defaultLocaleId) {
                      if (field === 'name') setName(value);
                      if (field === 'description') setDescription(value);
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
                      [targetId]: { name, description },
                    }));
                    setI18nDirty(true);
                  }}
                  disabled={saving}
                />
              ) : (
                <>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    Ad *
                    <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
                  </label>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    Açıklama
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
                  </label>
                </>
              )}
            </div>
            <label>
              Telefon
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <ContentSlugFields
              title={name}
              slug={slug}
              useCustomSlug={useCustomSlug}
              persistedSlug={editing?.slug}
              onUseCustomSlugChange={setUseCustomSlug}
              onSlugChange={setSlug}
              disabled={saving}
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} disabled={saving} />
            </div>
            {duplicateStoreId ? (
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#b45309' }}>
                Bu isimde bir kayıt zaten var.{' '}
                <button type="button" onClick={() => {
                  const existing = items.find((g) => g.id === duplicateStoreId);
                  if (existing) openEdit(existing);
                }}>
                  Mevcut mağazayı aç
                </button>
              </div>
            ) : null}
            <label>
              E-posta
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <div style={{ marginBottom: 8 }}>
              <ContextualMediaPicker
                context="STORE_LOGO"
                value={logoMediaId}
                onChange={setLogoMediaId}
              />
            </div>
            <label>
              Web sitesi
              <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} placeholder="https://..." />
            </label>
            <label>
              Durum
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as StoreStatus)} style={{ display: 'block', marginTop: 2, padding: 5 }}>
                <option value="ACTIVE">Aktif</option>
                <option value="PASSIVE">Pasif</option>
                <option value="ARCHIVED">Arşiv</option>
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="button" disabled={saving} onClick={() => void save()} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
                Kaydet
              </button>
              <button type="button" onClick={() => setShowForm(false)}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Yükleniyor…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Mağaza</th>
              <th style={{ padding: 8 }}>İletişim</th>
              <th style={{ padding: 8 }}>Durum</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{g.slug}</div>
                  {g.logoMedia && (
                    <img src={g.logoMedia.publicUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', marginTop: 4, borderRadius: 4 }} />
                  )}
                </td>
                <td style={{ padding: 8, fontSize: 12, color: '#4b5563' }}>
                  {g.phone ? <span>{g.phone}</span> : null}
                  {g.phone && g.email ? <br /> : null}
                  {g.email ? <a href={`mailto:${g.email}`}>{g.email}</a> : null}
                  {!g.phone && !g.email ? '—' : null}
                </td>
                <td style={{ padding: 8 }}>
                  <StatusBadge status={g.status} />
                </td>
                <td style={{ padding: 8 }}>
                  {canWrite && (
                    <>
                      <button type="button" onClick={() => openEdit(g)} style={{ marginRight: 6, fontSize: 12 }}>
                        Düzenle
                      </button>
                      <button type="button" onClick={() => void remove(g.id)} style={{ fontSize: 12, color: '#b91c1c' }}>
                        Sil
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </PageContainer>
  );
}
