import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  apiStoreCategoriesList,
  apiStoreCategoriesReorder,
  apiStoreCategoryCreate,
  apiStoreCategoryDelete,
  apiStoreCategoryUpdate,
  apiContentLocales,
  apiTranslationsList,
  apiTranslationUpsert,
  apiTranslationDelete,
  type StoreCategory,
  type CmsLocale,
} from '../lib/api';
import { ContentSlugFields } from './ContentSlugFields';
import {
  MultilingualContentFields,
  STORE_CATEGORY_I18N_FIELDS,
} from './MultilingualContentFields';
import { ContextualMediaPicker } from './ContextualMediaPicker';
import { usePermission } from '../hooks/usePermission';

type Props = {
  accessToken: string;
  tenantId: string;
  mallId: string;
  canEdit: boolean;
  search?: string;
  showScopeHint?: boolean;
};

type TreeNode = StoreCategory & { children: TreeNode[] };

function buildTree(categories: StoreCategory[]): TreeNode[] {
  const byParent = new Map<string | null, StoreCategory[]>();
  for (const cat of categories) {
    const key = cat.parentCategoryId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(cat);
    byParent.set(key, list);
  }
  const walk = (parentId: string | null): TreeNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'))
      .map((cat) => ({ ...cat, children: walk(cat.id) }));
  return walk(null);
}

export function MallStoreCategoriesSection({
  accessToken,
  tenantId,
  mallId,
  canEdit,
  search,
  showScopeHint = true,
}: Props) {
  const { can } = usePermission();
  const canReadTranslations = can('translation:read');
  const canCreateTranslations = can('translation:create');
  const canDeleteTranslations = can('translation:delete');
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<StoreCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [slug, setSlug] = useState('');
  const [useCustomSlug, setUseCustomSlug] = useState(false);
  const [active, setActive] = useState(true);
  const [color, setColor] = useState('');
  const [sameImageForAllLocales, setSameImageForAllLocales] = useState(true);
  const [iconMediaId, setIconMediaId] = useState('');
  const [coverMediaId, setCoverMediaId] = useState('');
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});

  const tree = useMemo(() => buildTree(categories), [categories]);
  const rootCategories = useMemo(() => categories.filter((c) => !c.parentCategoryId), [categories]);

  const parentOptions = useMemo(() => {
    const exclude = new Set<string>();
    if (editing) {
      const mark = (id: string) => {
        exclude.add(id);
        categories.filter((c) => c.parentCategoryId === id).forEach((c) => mark(c.id));
      };
      mark(editing.id);
    }
    return categories.filter((c) => !exclude.has(c.id));
  }, [categories, editing]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiStoreCategoriesList(accessToken, tenantId, mallId, {
        search: search || undefined,
      });
      setCategories(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kategoriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, search]);

  useEffect(() => {
    setEditing(null);
    setShowForm(false);
    setName('');
    setDescription('');
    setParentCategoryId('');
    setSlug('');
    setUseCustomSlug(false);
    setActive(true);
    setColor('');
    setSameImageForAllLocales(true);
    setIconMediaId('');
    setCoverMediaId('');
    setLocaleDrafts({});
  }, [mallId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showForm || !accessToken || !tenantId) return;
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
        if (editing && canReadTranslations) {
          const translations = await apiTranslationsList(accessToken, tenantId, {
            entityType: 'STORE_CATEGORY',
            entityId: editing.id,
          });
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            drafts[loc.id] = { name: '', description: '' };
            for (const field of STORE_CATEGORY_I18N_FIELDS) {
              drafts[loc.id][field] =
                translations.find((row) => row.localeId === loc.id && row.field === field)?.value ?? '';
            }
          }
          setLocaleDrafts(drafts);
        } else if (!editing) {
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            drafts[loc.id] = Object.fromEntries(
              STORE_CATEGORY_I18N_FIELDS.map((field) => [field, '']),
            );
          }
          setLocaleDrafts(drafts);
        } else {
          setLocaleDrafts({});
        }
      } catch {
        setTenantLocales([]);
        setLocaleDrafts({});
      }
    })();
  }, [showForm, editing?.id, accessToken, tenantId, mallId, canReadTranslations]);

  function resetForm() {
    setEditing(null);
    setName('');
    setDescription('');
    setParentCategoryId('');
    setSlug('');
    setUseCustomSlug(false);
    setActive(true);
    setColor('');
    setSameImageForAllLocales(true);
    setIconMediaId('');
    setCoverMediaId('');
    setLocaleDrafts({});
    setShowForm(false);
  }

  function openCreate(parentId?: string) {
    resetForm();
    setParentCategoryId(parentId ?? '');
    setShowForm(true);
  }

  function openEdit(cat: StoreCategory) {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description ?? '');
    setParentCategoryId(cat.parentCategoryId ?? '');
    setSlug(cat.slug);
    setUseCustomSlug(!cat.slugAutoGenerated);
    setActive(cat.active);
    setColor(cat.color ?? '');
    setSameImageForAllLocales(cat.sameImageForAllLocales);
    setIconMediaId(cat.iconMediaId ?? '');
    setCoverMediaId(cat.coverMediaId ?? '');
    setShowForm(true);
  }

  async function flushTranslations(entityId: string) {
    if (!canCreateTranslations) return;
    const defaultLocale = tenantLocales.find((l) => l.isDefault);
    const translations = await apiTranslationsList(accessToken, tenantId, {
      entityType: 'STORE_CATEGORY',
      entityId,
    });
    const idByKey = new Map(translations.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
    for (const loc of tenantLocales.filter((l) => l.isActive)) {
      if (!defaultLocale || loc.id === defaultLocale.id) continue;
      const slice = localeDrafts[loc.id] ?? {};
      for (const field of STORE_CATEGORY_I18N_FIELDS) {
        const value = (slice[field] ?? '').trim();
        const prevId = idByKey.get(`${loc.id}:${field}`);
        if (!value) {
          if (prevId && canDeleteTranslations) await apiTranslationDelete(accessToken, tenantId, prevId);
          continue;
        }
        await apiTranslationUpsert(accessToken, tenantId, {
          localeCode: loc.code,
          entityType: 'STORE_CATEGORY',
          entityId,
          field,
          value,
        });
      }
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Varsayılan dilde ad zorunludur.');
      return;
    }
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        parentCategoryId: parentCategoryId || null,
        slug: useCustomSlug ? slug.trim() || undefined : undefined,
        active,
        color: color.trim() || undefined,
        sameImageForAllLocales,
        iconMediaId: iconMediaId || null,
        coverMediaId: coverMediaId || null,
      };
      if (editing) {
        await apiStoreCategoryUpdate(accessToken, tenantId, mallId, editing.id, body);
        await flushTranslations(editing.id);
        toast.success('Kategori güncellendi');
      } else {
        const created = await apiStoreCategoryCreate(accessToken, tenantId, mallId, {
          ...body,
          sortOrder: rootCategories.length,
        });
        await flushTranslations(created.id);
        toast.success('Kategori oluşturuldu');
      }
      resetForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası');
    }
  }

  async function toggleActive(cat: StoreCategory) {
    try {
      await apiStoreCategoryUpdate(accessToken, tenantId, mallId, cat.id, { active: !cat.active });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncelleme hatası');
    }
  }

  async function removeCategory(id: string) {
    if (!window.confirm('Bu kategoriyi silmek istiyor musunuz?')) return;
    try {
      await apiStoreCategoryDelete(accessToken, tenantId, mallId, id);
      toast.success('Kategori silindi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme hatası');
    }
  }

  async function moveRoot(id: string, direction: -1 | 1) {
    const roots = [...rootCategories].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = roots.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= roots.length) return;
    const ordered = [...roots];
    const [item] = ordered.splice(index, 1);
    ordered.splice(target, 0, item);
    try {
      await apiStoreCategoriesReorder(accessToken, tenantId, mallId, ordered.map((c) => c.id));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıralama hatası');
    }
  }

  function renderNode(node: TreeNode, depth = 0) {
    const isRoot = depth === 0;
    return (
      <div key={node.id} style={{ marginLeft: depth * 20, marginBottom: 6 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            background: node.active ? '#fff' : '#f9fafb',
          }}
        >
          <span style={{ flex: 1, fontWeight: depth === 0 ? 600 : 400 }}>{node.name}</span>
          <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{node.slug}</span>
          <span
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              background: node.active ? '#d1fae5' : '#f3f4f6',
              color: node.active ? '#065f46' : '#6b7280',
            }}
          >
            {node.active ? 'Aktif' : 'Pasif'}
          </span>
          {canEdit ? (
            <>
              {isRoot ? (
                <>
                  <button type="button" onClick={() => void moveRoot(node.id, -1)} style={{ fontSize: 12 }}>↑</button>
                  <button type="button" onClick={() => void moveRoot(node.id, 1)} style={{ fontSize: 12 }}>↓</button>
                </>
              ) : null}
              <button type="button" onClick={() => openCreate(node.id)} style={{ fontSize: 12 }}>+ Alt</button>
              <button type="button" onClick={() => openEdit(node)} style={{ fontSize: 12 }}>Düzenle</button>
              <button type="button" onClick={() => void toggleActive(node)} style={{ fontSize: 12 }}>
                {node.active ? 'Pasifleştir' : 'Aktifleştir'}
              </button>
              <button type="button" onClick={() => void removeCategory(node.id)} style={{ fontSize: 12, color: '#b91c1c' }}>
                Sil
              </button>
            </>
          ) : null}
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        {showScopeHint ? (
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Kategoriler yalnızca bu lokasyona özeldir. Aynı marka farklı AVM&apos;lerde farklı kategorilere atanabilir.
          </p>
        ) : (
          <span />
        )}
        {canEdit ? (
          <button
            type="button"
            onClick={() => openCreate()}
            style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}
          >
            + Kök Kategori
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{editing ? 'Kategori düzenle' : 'Yeni kategori'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 900 }}>
            {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <MultilingualContentFields
                  locales={tenantLocales}
                  fields={STORE_CATEGORY_I18N_FIELDS}
                  requiredField="name"
                  activeLocaleId={contentLocaleTab}
                  onTabChange={setContentLocaleTab}
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
                  }}
                  disabled={!canEdit}
                  onCopyFromDefault={(targetLocaleId) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (!defaultLocaleId) return;
                    setLocaleDrafts((drafts) => ({
                      ...drafts,
                      [targetLocaleId]: {
                        ...(drafts[targetLocaleId] ?? {}),
                        name,
                        description,
                      },
                    }));
                  }}
                />
              </div>
            ) : (
              <>
                <label style={{ gridColumn: '1 / -1' }}>
                  Ad *
                  <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Açıklama
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, minHeight: 60 }} />
                </label>
              </>
            )}
            <label>
              Üst kategori
              <select
                value={parentCategoryId}
                onChange={(e) => setParentCategoryId(e.target.value)}
                disabled={!canEdit}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
              >
                <option value="">— Kök —</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              Renk
              <input value={color} onChange={(e) => setColor(e.target.value)} disabled={!canEdit} placeholder="#2563eb" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }} />
            </label>
            <ContentSlugFields
              title={name}
              slug={slug}
              useCustomSlug={useCustomSlug}
              persistedSlug={editing?.slug}
              onUseCustomSlugChange={setUseCustomSlug}
              onSlugChange={setSlug}
              disabled={!canEdit}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!canEdit} />
              Aktif
            </label>
            <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={sameImageForAllLocales}
                onChange={(e) => setSameImageForAllLocales(e.target.checked)}
                disabled={!canEdit}
              />
              Tüm dillerde aynı görsel
            </label>
            {sameImageForAllLocales ? (
              <>
                <ContextualMediaPicker context="SERVICE_ICON" value={iconMediaId} disabled={!canEdit} onChange={setIconMediaId} />
                <ContextualMediaPicker context="SERVICE_COVER" value={coverMediaId} disabled={!canEdit} onChange={setCoverMediaId} />
              </>
            ) : null}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="button" disabled={!canEdit} onClick={() => void save()} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
                Kaydet
              </button>
              <button type="button" onClick={resetForm} style={{ padding: '6px 14px' }}>İptal</button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Yükleniyor…</p>
      ) : tree.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Henüz kategori yok.</p>
      ) : (
        <div>{tree.map((node) => renderNode(node))}</div>
      )}
    </div>
  );
}
