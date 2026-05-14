import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { usePermission } from '../hooks/usePermission';
import {
  apiLocaleCreate,
  apiLocaleDeactivate,
  apiLocaleSetDefault,
  apiLocaleUpdate,
  apiLocalesList,
  apiLocalesReorder,
  type CmsLocale,
  type CreateLocalePayload,
} from '../lib/api';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
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
  marginBottom: 4,
};

export function LocalesPage() {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();

  const [items, setItems] = useState<CmsLocale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    nativeName: '',
    isDefault: false,
    isActive: true,
  });
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<CmsLocale | null>(null);
  const [editForm, setEditForm] = useState({ name: '', nativeName: '', isActive: true });
  const [savingEdit, setSavingEdit] = useState(false);
  const [reordering, setReordering] = useState(false);

  const tenantId = activeTenantId;

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiLocalesList(accessToken, tenantId);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diller yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(loc: CmsLocale) {
    setEditing(loc);
    setEditForm({
      name: loc.name,
      nativeName: loc.nativeName,
      isActive: loc.isActive,
    });
  }

  async function handleCreate() {
    if (!accessToken || !tenantId) return;
    if (!createForm.code.trim() || !createForm.name.trim() || !createForm.nativeName.trim()) {
      toast.error('Kod, ad ve yerel ad zorunludur.');
      return;
    }
    setCreating(true);
    try {
      const body: CreateLocalePayload = {
        code: createForm.code.trim(),
        name: createForm.name.trim(),
        nativeName: createForm.nativeName.trim(),
        isDefault: createForm.isDefault,
        isActive: createForm.isActive,
      };
      await apiLocaleCreate(accessToken, tenantId, body);
      toast.success('Dil oluşturuldu');
      setShowCreate(false);
      setCreateForm({ code: '', name: '', nativeName: '', isDefault: false, isActive: true });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!accessToken || !tenantId || !editing) return;
    setSavingEdit(true);
    try {
      await apiLocaleUpdate(accessToken, tenantId, editing.id, {
        name: editForm.name.trim(),
        nativeName: editForm.nativeName.trim(),
        isActive: editForm.isActive,
      });
      toast.success('Dil güncellendi');
      setEditing(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeactivate(loc: CmsLocale) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm(`"${loc.code}" dilini pasifleştirmek istediğinize emin misiniz?`)) return;
    try {
      await apiLocaleDeactivate(accessToken, tenantId, loc.id);
      toast.success('Dil pasifleştirildi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  }

  async function handleMove(loc: CmsLocale, delta: number) {
    if (!accessToken || !tenantId) return;
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    const idx = sorted.findIndex((x) => x.id === loc.id);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[j]] = [next[j], next[idx]];
    setReordering(true);
    try {
      const updated = await apiLocalesReorder(
        accessToken,
        tenantId,
        next.map((x) => x.id),
      );
      setItems(updated);
      toast.success('Sıra güncellendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıra güncellenemedi');
    } finally {
      setReordering(false);
    }
  }

  async function handleSetDefault(loc: CmsLocale) {
    if (!accessToken || !tenantId) return;
    try {
      await apiLocaleSetDefault(accessToken, tenantId, loc.id);
      toast.success('Varsayılan dil güncellendi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ayarlanamadı');
    }
  }

  if (!tenantId) {
    return (
      <PageContainer>
        <PageHeader title="Yerelleştirme" />
        <EmptyState title="Tenant seçilmedi" description="Dil yönetimi için üstten bir tenant seçin." />
      </PageContainer>
    );
  }

  if (!can('locale:read')) {
    return (
      <PageContainer>
        <PageHeader title="Yerelleştirme" />
        <EmptyState title="Erişim yok" description="Bu sayfa için locale:read yetkisi gerekir." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Yerelleştirme"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{items.length} dil tanımı</span>}
        action={
          can('locale:create') ? (
            <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? 'Formu gizle' : '+ Yeni dil'}
            </Button>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {showCreate && can('locale:create') && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            background: '#fafafa',
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Yeni dil</h3>
          <div style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
            <div>
              <label style={labelStyle}>Kod (ör. tr, en)</label>
              <input
                style={inputStyle}
                value={createForm.code}
                onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Ad</label>
              <input
                style={inputStyle}
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Yerel ad</label>
              <input
                style={inputStyle}
                value={createForm.nativeName}
                onChange={(e) => setCreateForm((f) => ({ ...f, nativeName: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={createForm.isDefault}
                onChange={(e) => setCreateForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Varsayılan dil
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Aktif
            </label>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button variant="primary" disabled={creating} onClick={() => void handleCreate()}>
              {creating ? 'Kaydediliyor…' : 'Oluştur'}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              İptal
            </Button>
          </div>
        </div>
      )}

      {loading && <LoadingState />}

      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Sıra</th>
                <th style={{ padding: 8 }}>Kod</th>
                <th style={{ padding: 8 }}>Ad</th>
                <th style={{ padding: 8 }}>Yerel ad</th>
                <th style={{ padding: 8 }}>RTL</th>
                <th style={{ padding: 8 }}>Durum</th>
                <th style={{ padding: 8 }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {[...items]
                .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
                .map((loc) => (
                <tr key={loc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>
                    {can('locale:update') ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          disabled={reordering}
                          title="Yukarı"
                          onClick={() => void handleMove(loc, -1)}
                          style={{ padding: '2px 6px', fontSize: 11 }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={reordering}
                          title="Aşağı"
                          onClick={() => void handleMove(loc, 1)}
                          style={{ padding: '2px 6px', fontSize: 11 }}
                        >
                          ↓
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>{loc.sortOrder}</span>
                    )}
                  </td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{loc.code}</td>
                  <td style={{ padding: 8 }}>{loc.name}</td>
                  <td style={{ padding: 8, color: '#6b7280' }}>{loc.nativeName}</td>
                  <td style={{ padding: 8 }}>{loc.rtl ? <Badge variant="blue">RTL</Badge> : '—'}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {loc.isActive ? <Badge variant="green">Aktif</Badge> : <Badge variant="gray">Pasif</Badge>}
                      {loc.isDefault && <Badge variant="blue">Varsayılan</Badge>}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>
                    {can('locale:update') && (
                      <Button size="sm" variant="secondary" onClick={() => openEdit(loc)} style={{ marginRight: 6 }}>
                        Düzenle
                      </Button>
                    )}
                    {can('locale:set-default') && loc.isActive && !loc.isDefault && (
                      <Button size="sm" variant="secondary" onClick={() => void handleSetDefault(loc)} style={{ marginRight: 6 }}>
                        Varsayılan yap
                      </Button>
                    )}
                    {can('locale:delete') && loc.isActive && (
                      <Button size="sm" variant="danger" onClick={() => void handleDeactivate(loc)}>
                        Pasifleştir
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && can('locale:update') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 20,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Dili düzenle: {editing.code}</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={labelStyle}>Ad</label>
                <input
                  style={inputStyle}
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label style={labelStyle}>Yerel ad</label>
                <input
                  style={inputStyle}
                  value={editForm.nativeName}
                  onChange={(e) => setEditForm((f) => ({ ...f, nativeName: e.target.value }))}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Aktif
              </label>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Button variant="primary" disabled={savingEdit} onClick={() => void handleSaveEdit()}>
                {savingEdit ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
