import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  apiStoreCategoriesList,
  apiStoreCategoryCreate,
  apiStoreCategoryDelete,
  apiStoreCategoryUpdate,
  type StoreCategory,
  type StoreCategoryStatus,
} from '../lib/api';

const STATUS_LABEL: Record<StoreCategoryStatus, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#d1fae5', color: '#065f46', label: 'Aktif' },
  PASSIVE: { bg: '#f3f4f6', color: '#374151', label: 'Pasif' },
};

function StatusBadge({ status }: { status: StoreCategoryStatus }) {
  const s = STATUS_LABEL[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export function StoreCategoriesPage() {
  const { accessToken, activeTenantId } = useAuth();
  const [items, setItems] = useState<StoreCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StoreCategoryStatus | ''>('');

  const [editing, setEditing] = useState<StoreCategory | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [formStatus, setFormStatus] = useState<StoreCategoryStatus>('ACTIVE');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const tenantId = activeTenantId;

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiStoreCategoriesList(accessToken, tenantId, {
        search: search || undefined,
        status: status || undefined,
        limit: 100,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName('');
    setSlug('');
    setSortOrder('0');
    setFormStatus('ACTIVE');
    setShowForm(true);
  }

  function openEdit(c: StoreCategory) {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setSortOrder(String(c.sortOrder));
    setFormStatus(c.status);
    setShowForm(true);
  }

  async function save() {
    if (!accessToken || !tenantId || !name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const u = await apiStoreCategoryUpdate(accessToken, tenantId, editing.id, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          sortOrder: parseInt(sortOrder, 10) || 0,
          status: formStatus,
        });
        setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      } else {
        const c = await apiStoreCategoryCreate(accessToken, tenantId, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          sortOrder: parseInt(sortOrder, 10) || 0,
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
    if (!window.confirm('Kategoriyi silmek istiyor musunuz?')) return;
    try {
      await apiStoreCategoryDelete(accessToken, tenantId, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silme hatası');
    }
  }

  if (!tenantId) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>Mağaza kategorileri için tenant seçin.</p>;
  }

  return (
    <div style={{ fontSize: 13 }}>
      {error && (
        <div style={{ marginBottom: 12, padding: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c' }}>
          {error}
          <button type="button" style={{ marginLeft: 8 }} onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Ada göre ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 5, border: '1px solid #d1d5db', borderRadius: 4, width: 180 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StoreCategoryStatus | '')} style={{ padding: 5, borderRadius: 4 }}>
          <option value="">Tüm durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
        </select>
        <button type="button" onClick={() => void load()} style={{ padding: '5px 12px' }}>
          Filtrele
        </button>
        <span style={{ color: '#6b7280' }}>{total} kayıt</span>
        <button type="button" onClick={openCreate} style={{ marginLeft: 'auto', padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
          + Kategori
        </button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{editing ? 'Kategori düzenle' : 'Yeni kategori'}</h3>
          <div style={{ display: 'grid', gap: 8, maxWidth: 400 }}>
            <label>
              Ad *
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Slug (opsiyonel)
              <input value={slug} onChange={(e) => setSlug(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Sıra
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, padding: 5 }} />
            </label>
            <label>
              Durum
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as StoreCategoryStatus)} style={{ display: 'block', marginTop: 2, padding: 5 }}>
                <option value="ACTIVE">Aktif</option>
                <option value="PASSIVE">Pasif</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={saving} onClick={() => void save()} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
                {saving ? '…' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '6px 14px' }}>
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
              <th style={{ padding: 8 }}>Ad</th>
              <th style={{ padding: 8 }}>Slug</th>
              <th style={{ padding: 8 }}>Sıra</th>
              <th style={{ padding: 8 }}>Durum</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 8 }}>{c.name}</td>
                <td style={{ padding: 8, color: '#6b7280' }}>{c.slug}</td>
                <td style={{ padding: 8 }}>{c.sortOrder}</td>
                <td style={{ padding: 8 }}>
                  <StatusBadge status={c.status} />
                </td>
                <td style={{ padding: 8 }}>
                  <button type="button" onClick={() => openEdit(c)} style={{ marginRight: 6, fontSize: 12 }}>
                    Düzenle
                  </button>
                  <button type="button" onClick={() => void remove(c.id)} style={{ fontSize: 12, color: '#b91c1c' }}>
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
