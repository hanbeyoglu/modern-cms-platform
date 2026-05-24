import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { useMallRequired } from '../hooks/useMallRequired';
import { MallRequiredStates } from '../components/MallRequiredStates';
import { MALL_STORE_I18N_FIELDS, MultilingualContentFields } from '../components/MultilingualContentFields';
import { LinkedSliderGroupsSection } from '../components/LinkedSliderGroupsSection';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  apiGlobalStoresList,
  apiLocalesList,
  apiMallStoreAssign,
  apiMallStoreDelete,
  apiMallStoreFeature,
  apiMallStoreUnfeature,
  apiMallStoreUpdate,
  apiMallStoresList,
  apiStoreCategoriesList,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  type CmsLocale,
  type GlobalStore,
  type GlobalStoreCategoryPreview,
  type MallStore,
  type StoreCategory,
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

function mallStoreCategories(m: MallStore): GlobalStoreCategoryPreview[] {
  if (m.categories?.length) return m.categories;
  return (m.categoryLinks ?? []).map((link) => link.storeCategory);
}

function GlobalStorePreview({ store, readonly }: { store: GlobalStore; readonly?: boolean }) {
  return (
    <div>
      {readonly ? (
        <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>
          Atanan global marka (değiştirmek için önce bu atamayı kaldırıp yeniden oluşturun).
        </p>
      ) : null}
      <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 10,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: readonly ? '#f9fafb' : '#fff',
        marginTop: readonly ? 0 : 8,
      }}
    >
      {store.logoMedia?.publicUrl ? (
        <img
          src={store.logoMedia.publicUrl}
          alt=""
          style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 6, background: '#f3f4f6' }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 6,
            background: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: '#9ca3af',
          }}
        >
          Logo yok
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{store.name}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{store.slug}</div>
        {store.phone ? <div style={{ fontSize: 12, color: '#374151' }}>Tel: {store.phone}</div> : null}
        {store.email ? (
          <div style={{ fontSize: 12 }}>
            <a href={`mailto:${store.email}`} style={{ color: '#2563eb' }}>
              {store.email}
            </a>
          </div>
        ) : null}
        {store.websiteUrl ? (
          <a
            href={store.websiteUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: '#2563eb' }}
          >
            {store.websiteUrl}
          </a>
        ) : (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Web sitesi yok</span>
        )}
      </div>
    </div>
    </div>
  );
}

function parseJsonField(raw: string, label: string): Record<string, unknown> | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    const v = JSON.parse(t) as unknown;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new Error(`${label} bir JSON nesnesi olmalıdır`);
    }
    return v as Record<string, unknown>;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `${label} JSON hatası`);
  }
}

export function MallStoresPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const { can } = usePermission();
  const [items, setItems] = useState<MallStore[]>([]);
  const [globals, setGlobals] = useState<GlobalStore[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showAssign, setShowAssign] = useState(false);
  const [globalStoreId, setGlobalStoreId] = useState('');
  const [globalStoreSearch, setGlobalStoreSearch] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<MallStore | null>(null);
  const [localName, setLocalName] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [floor, setFloor] = useState('');
  const [storeNo, setStoreNo] = useState('');
  const [workingHoursJson, setWorkingHoursJson] = useState('');
  const [locationJson, setLocationJson] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [formStatus, setFormStatus] = useState<StoreStatus>('ACTIVE');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isSoon, setIsSoon] = useState(false);
  const [searchTagsText, setSearchTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';

  const load = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, glob, cats] = await Promise.all([
        apiMallStoresList(accessToken, tenantId, mallId, { search: search || undefined, limit: 100 }),
        apiGlobalStoresList(accessToken, tenantId, { limit: 100, status: 'ACTIVE' }),
        apiStoreCategoriesList(accessToken, tenantId, { limit: 100, status: 'ACTIVE' }),
      ]);
      setItems(res.items);
      setTotal(res.total);
      setGlobals(glob.items);
      setCategories(cats.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showAssign || !i18nDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [showAssign, i18nDirty]);

  useEffect(() => {
    if (!showAssign || !accessToken || !tenantId) {
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
            entityType: 'STORE',
            entityId: editing.id,
          });
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            drafts[loc.id] = { localName: '', localDescription: '' };
            for (const field of MALL_STORE_I18N_FIELDS) {
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
  }, [showAssign, editing?.id, accessToken, tenantId]);

  const flushMallStoreTranslations = useCallback(
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
        for (const field of MALL_STORE_I18N_FIELDS) {
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

  const filteredGlobals = globals.filter((g) => {
    const q = globalStoreSearch.trim().toLowerCase();
    if (!q) return true;
    return g.name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q);
  });

  const selectedGlobal =
    globals.find((g) => g.id === globalStoreId) ?? (editing ? editing.globalStore : null);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function openAssign() {
    setEditing(null);
    setGlobalStoreId('');
    setGlobalStoreSearch('');
    setCategoryIds([]);
    setLocalName('');
    setLocalDescription('');
    setFloor('');
    setStoreNo('');
    setWorkingHoursJson('');
    setLocationJson('');
    setSortOrder('0');
    setFormStatus('ACTIVE');
    setIsFeatured(false);
    setIsSoon(false);
    setSearchTagsText('');
    setLocaleDrafts({});
    setI18nDirty(false);
    setShowAssign(true);
  }

  function openEdit(m: MallStore) {
    setEditing(m);
    setGlobalStoreId(m.globalStoreId);
    setGlobalStoreSearch('');
    setCategoryIds(mallStoreCategories(m).map((c) => c.id));
    setLocalName(m.localName ?? '');
    setLocalDescription(m.localDescription ?? '');
    setFloor(m.floor ?? '');
    setStoreNo(m.storeNo ?? '');
    setWorkingHoursJson(m.workingHoursJson ? JSON.stringify(m.workingHoursJson, null, 2) : '');
    setLocationJson(m.locationJson ? JSON.stringify(m.locationJson, null, 2) : '');
    setSortOrder(String(m.sortOrder));
    setFormStatus(m.status);
    setIsFeatured(m.isFeatured);
    setIsSoon(m.isSoon);
    setSearchTagsText(m.searchTags?.join(', ') ?? '');
    setI18nDirty(false);
    setShowAssign(true);
  }

  function parseSearchTags(raw: string): string[] {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function save() {
    if (!accessToken || !tenantId || !mallId) return;
    setSaving(true);
    setError(null);
    try {
      let wh: Record<string, unknown> | undefined;
      let loc: Record<string, unknown> | undefined;
      try {
        wh = parseJsonField(workingHoursJson, 'Çalışma saatleri');
        loc = parseJsonField(locationJson, 'Konum');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'JSON');
        setSaving(false);
        return;
      }

      if (editing) {
        const u = await apiMallStoreUpdate(accessToken, tenantId, mallId, editing.id, {
          localName: localName.trim() || null,
          localDescription: localDescription.trim() || null,
          floor: floor.trim() || null,
          storeNo: storeNo.trim() || null,
          ...(wh !== undefined ? { workingHoursJson: wh } : {}),
          ...(loc !== undefined ? { locationJson: loc } : {}),
          sortOrder: parseInt(sortOrder, 10) || 0,
          status: formStatus,
          isFeatured,
          isSoon,
          searchTags: parseSearchTags(searchTagsText),
          categoryIds,
        });
        setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        await flushMallStoreTranslations(u.id);
      } else {
        if (!globalStoreId) {
          setError('Global mağaza seçin.');
          setSaving(false);
          return;
        }
        const c = await apiMallStoreAssign(accessToken, tenantId, mallId, {
          globalStoreId,
          localName: localName.trim() || undefined,
          localDescription: localDescription.trim() || undefined,
          floor: floor.trim() || undefined,
          storeNo: storeNo.trim() || undefined,
          ...(wh !== undefined ? { workingHoursJson: wh } : {}),
          ...(loc !== undefined ? { locationJson: loc } : {}),
          sortOrder: parseInt(sortOrder, 10) || 0,
          status: formStatus,
          isFeatured,
          isSoon,
          searchTags: parseSearchTags(searchTagsText),
          categoryIds,
        });
        setItems((prev) => [c, ...prev]);
        setTotal((t) => t + 1);
        await flushMallStoreTranslations(c.id);
      }
      setShowAssign(false);
      setLocaleDrafts({});
      setI18nDirty(false);
      toast.success(editing ? 'AVM mağazası güncellendi' : 'Mağaza AVM\'ye atandı');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!accessToken || !tenantId || !mallId) return;
    if (!window.confirm('Bu AVM atamasını kaldırmak istiyor musunuz?')) return;
    try {
      await apiMallStoreDelete(accessToken, tenantId, mallId, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      toast.success('AVM ataması kaldırıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme hatası');
    }
  }

  async function toggleFeature(m: MallStore) {
    if (!accessToken || !tenantId || !mallId) return;
    try {
      const u = m.isFeatured
        ? await apiMallStoreUnfeature(accessToken, tenantId, mallId, m.id)
        : await apiMallStoreFeature(accessToken, tenantId, mallId, m.id);
      setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      toast.success(u.isFeatured ? 'Öne çıkarıldı' : 'Öne çıkarma kaldırıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem hatası');
    }
  }

  return (
    <MallRequiredStates
      title="AVM Mağazaları"
      status={mallCtx}
      noSelectionDescription="AVM mağaza listesi için üstten bir AVM seçin."
    >
    <PageContainer>
      <PageHeader
        title="AVM Mağazaları"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} mağaza</span>}
        action={<Button variant="primary" onClick={openAssign}>+ Mağaza Ata</Button>}
      />
    <div style={{ fontSize: 13 }}>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Global / yerel ada göre ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 5, borderRadius: 4, width: 200 }}
        />
        <button type="button" onClick={() => void load()}>
          Filtrele
        </button>
        <span style={{ color: '#6b7280' }}>{total} atama</span>
        <button type="button" onClick={openAssign} style={{ marginLeft: 'auto', padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
          + Mağaza ata
        </button>
      </div>

      {showAssign && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{editing ? 'AVM mağaza detayı' : 'Global mağazayı AVM\'ye ata'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 800 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                Global Mağaza {!editing && '*'}
              </label>
              {!editing && (
                <input
                  type="search"
                  placeholder="Marka adı veya slug ile ara…"
                  value={globalStoreSearch}
                  onChange={(e) => setGlobalStoreSearch(e.target.value)}
                  style={{ display: 'block', width: '100%', marginBottom: 6, padding: 6, borderRadius: 4, border: '1px solid #d1d5db' }}
                />
              )}
              {!editing ? (
                <select
                  required
                  value={globalStoreId}
                  onChange={(e) => setGlobalStoreId(e.target.value)}
                  style={{ display: 'block', width: '100%', padding: 6, borderRadius: 4, border: '1px solid #d1d5db' }}
                >
                  <option value="">— Global mağaza seçin —</option>
                  {filteredGlobals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.slug})
                    </option>
                  ))}
                </select>
              ) : null}
              {selectedGlobal ? <GlobalStorePreview store={selectedGlobal} readonly={!!editing} /> : null}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>AVM içindeki kategoriler</label>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
                Aynı marka farklı lokasyonlarda farklı kategorilere sahip olabilir.
              </p>
              {categories.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af' }}>Henüz kategori tanımlı değil.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map((cat) => (
                    <label
                      key={cat.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        background: categoryIds.includes(cat.id) ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={categoryIds.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
                <MultilingualContentFields
                  locales={tenantLocales}
                  fields={MALL_STORE_I18N_FIELDS}
                  requiredField={null}
                  activeLocaleId={contentLocaleTab}
                  onTabChange={(localeId) => setContentLocaleTab(localeId)}
                  defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                  getValue={(localeId, field) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (defaultLocaleId && localeId === defaultLocaleId) {
                      return field === 'localName' ? localName : localDescription;
                    }
                    return localeDrafts[localeId]?.[field] ?? '';
                  }}
                  setValue={(localeId, field, value) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (defaultLocaleId && localeId === defaultLocaleId) {
                      if (field === 'localName') setLocalName(value);
                      if (field === 'localDescription') setLocalDescription(value);
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
                      [targetId]: { localName, localDescription },
                    }));
                    setI18nDirty(true);
                  }}
                  disabled={saving}
                />
              ) : (
                <>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    Yerel ad
                    <input value={localName} onChange={(e) => setLocalName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
                  </label>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    Yerel açıklama
                    <textarea value={localDescription} onChange={(e) => setLocalDescription(e.target.value)} rows={2} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
                  </label>
                </>
              )}
            </div>
            <label>
              Kat
              <input value={floor} onChange={(e) => setFloor(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Mağaza no
              <input value={storeNo} onChange={(e) => setStoreNo(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Sıra
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Durum
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as StoreStatus)} style={{ display: 'block', marginTop: 2, padding: 5 }}>
                <option value="ACTIVE">Aktif</option>
                <option value="PASSIVE">Pasif</option>
                <option value="ARCHIVED">Arşiv</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
              Öne çıkan
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={isSoon} onChange={(e) => setIsSoon(e.target.checked)} />
              Yakında açılacak
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Arama etiketleri (virgülle)
              <input
                value={searchTagsText}
                onChange={(e) => setSearchTagsText(e.target.value)}
                placeholder="ör. kahve, fast-food"
                style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }}
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Çalışma saatleri (JSON nesnesi, opsiyonel)
              <textarea value={workingHoursJson} onChange={(e) => setWorkingHoursJson(e.target.value)} rows={3} style={{ display: 'block', width: '100%', marginTop: 2, fontFamily: 'monospace', fontSize: 12 }} placeholder='{"mon": "10-22"}' />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Konum (JSON nesnesi, opsiyonel)
              <textarea value={locationJson} onChange={(e) => setLocationJson(e.target.value)} rows={2} style={{ display: 'block', width: '100%', marginTop: 2, fontFamily: 'monospace', fontSize: 12 }} />
            </label>
            {editing && mallId && (
              <LinkedSliderGroupsSection
                entityType="STORE"
                entityId={editing.id}
                mallId={mallId}
              />
            )}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="button" disabled={saving} onClick={() => void save()} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
                Kaydet
              </button>
              <button type="button" onClick={() => setShowAssign(false)}>
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
              <th style={{ padding: 8 }}>Global marka</th>
              <th style={{ padding: 8 }}>Kategoriler</th>
              <th style={{ padding: 8 }}>Kat / No</th>
              <th style={{ padding: 8 }}>Öne çıkan</th>
              <th style={{ padding: 8 }}>Durum</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{m.localName || m.globalStore.name}</div>
                  {m.isSoon ? (
                    <span style={{ marginTop: 4, display: 'inline-block' }}>
                      <Badge variant="blue">Yakında</Badge>
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.globalStore.logoMedia?.publicUrl ? (
                      <img
                        src={m.globalStore.logoMedia.publicUrl}
                        alt=""
                        style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }}
                      />
                    ) : null}
                    <div>
                      <div style={{ fontWeight: 500 }}>{m.globalStore.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{m.globalStore.slug}</div>
                      {m.globalStore.websiteUrl ? (
                        <a
                          href={m.globalStore.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 11, color: '#2563eb' }}
                        >
                          Web sitesi
                        </a>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td style={{ padding: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {mallStoreCategories(m).length > 0 ? (
                      mallStoreCategories(m).map((cat) => (
                        <Badge key={cat.id} variant="gray">
                          {cat.name}
                        </Badge>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: 8 }}>
                  {m.floor ?? '—'} / {m.storeNo ?? '—'}
                </td>
                <td style={{ padding: 8 }}>{m.isFeatured ? 'Evet' : 'Hayır'}</td>
                <td style={{ padding: 8 }}>
                  <StatusBadge status={m.status} />
                </td>
                <td style={{ padding: 8 }}>
                  <button type="button" onClick={() => openEdit(m)} style={{ fontSize: 12, marginRight: 4 }}>
                    Düzenle
                  </button>
                  <button type="button" onClick={() => void toggleFeature(m)} style={{ fontSize: 12, marginRight: 4 }}>
                    {m.isFeatured ? 'Öne çıkarma' : 'Öne çıkar'}
                  </button>
                  <button type="button" onClick={() => void remove(m.id)} style={{ fontSize: 12, color: '#b91c1c' }}>
                    Kaldır
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </PageContainer>
    </MallRequiredStates>
  );
}
