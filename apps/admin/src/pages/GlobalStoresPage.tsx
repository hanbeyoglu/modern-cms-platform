import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  apiGlobalStoreCreate,
  apiGlobalStoreDelete,
  apiGlobalStoreUpdate,
  apiGlobalStoresList,
  apiMediaList,
  apiStoreCategoriesList,
  type GlobalStore,
  type MediaAsset,
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

export function GlobalStoresPage() {
  const { accessToken, activeTenantId } = useAuth();
  const [items, setItems] = useState<GlobalStore[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [filterStatus, setFilterStatus] = useState<StoreStatus | ''>('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GlobalStore | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoMediaId, setLogoMediaId] = useState('');
  const [catId, setCatId] = useState('');
  const [formStatus, setFormStatus] = useState<StoreStatus>('ACTIVE');
  const [saving, setSaving] = useState(false);

  const tenantId = activeTenantId;

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, cats, med] = await Promise.all([
        apiGlobalStoresList(accessToken, tenantId, {
          search: search || undefined,
          categoryId: categoryId || undefined,
          status: filterStatus || undefined,
          limit: 100,
        }),
        apiStoreCategoriesList(accessToken, tenantId, { limit: 200 }),
        apiMediaList(accessToken, tenantId, { limit: 200 }),
      ]);
      setItems(res.items);
      setTotal(res.total);
      setCategories(cats.items);
      setMedia(med.assets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, categoryId, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName('');
    setSlug('');
    setDescription('');
    setWebsiteUrl('');
    setLogoMediaId('');
    setCatId('');
    setFormStatus('ACTIVE');
    setShowForm(true);
  }

  function openEdit(g: GlobalStore) {
    setEditing(g);
    setName(g.name);
    setSlug(g.slug);
    setDescription(g.description ?? '');
    setWebsiteUrl(g.websiteUrl ?? '');
    setLogoMediaId(g.logoMediaId ?? '');
    setCatId(g.categoryId ?? '');
    setFormStatus(g.status);
    setShowForm(true);
  }

  async function save() {
    if (!accessToken || !tenantId || !name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const u = await apiGlobalStoreUpdate(accessToken, tenantId, editing.id, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          logoMediaId: logoMediaId || null,
          categoryId: catId || null,
          status: formStatus,
        });
        setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      } else {
        const c = await apiGlobalStoreCreate(accessToken, tenantId, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          logoMediaId: logoMediaId || undefined,
          categoryId: catId || undefined,
          status: formStatus,
        });
        setItems((prev) => [c, ...prev]);
        setTotal((t) => t + 1);
      }
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt hatası');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silme hatası');
    }
  }

  if (!tenantId) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>Global mağazalar için tenant seçin.</p>;
  }

  return (
    <div style={{ fontSize: 13 }}>
      {error && (
        <div style={{ marginBottom: 12, padding: 8, background: '#fef2f2', borderRadius: 6, color: '#b91c1c' }}>
          {error}
          <button type="button" style={{ marginLeft: 8 }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Ada göre ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 5, border: '1px solid #d1d5db', borderRadius: 4, width: 160 }}
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ padding: 5, borderRadius: 4 }}>
          <option value="">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
        <button type="button" onClick={openCreate} style={{ marginLeft: 'auto', padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
          + Global mağaza
        </button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{editing ? 'Düzenle' : 'Yeni global mağaza'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 720 }}>
            <label style={{ gridColumn: '1 / -1' }}>
              Ad *
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Slug
              <input value={slug} onChange={(e) => setSlug(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Kategori
              <select value={catId} onChange={(e) => setCatId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Logo (medya)
              <select value={logoMediaId} onChange={(e) => setLogoMediaId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }}>
                <option value="">—</option>
                {media.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.originalName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Web sitesi
              <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} placeholder="https://..." />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Açıklama
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
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
              <th style={{ padding: 8 }}>Kategori</th>
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
                <td style={{ padding: 8 }}>{g.category?.name ?? '—'}</td>
                <td style={{ padding: 8 }}>
                  <StatusBadge status={g.status} />
                </td>
                <td style={{ padding: 8 }}>
                  <button type="button" onClick={() => openEdit(g)} style={{ marginRight: 6, fontSize: 12 }}>
                    Düzenle
                  </button>
                  <button type="button" onClick={() => void remove(g.id)} style={{ fontSize: 12, color: '#b91c1c' }}>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
