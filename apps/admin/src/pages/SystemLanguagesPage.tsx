import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { LoadingState } from '../components/ui/LoadingState';
import {
  apiSystemLocaleCreate,
  apiSystemLocaleDeactivate,
  apiSystemLocaleSetDefault,
  apiSystemLocaleUpdate,
  apiSystemLocalesList,
  apiSystemLocalesReorder,
  type CmsLocale,
} from '../lib/api/system-locales';

const CATALOG_SUGGESTIONS = [
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', rtl: false },
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
  { code: 'jp', name: 'Japanese', nativeName: '日本語', rtl: false },
] as const;

type FormState = {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  name: '',
  nativeName: '',
  rtl: false,
  isActive: true,
});

export function SystemLanguagesPage() {
  const { accessToken, tenants, activeTenantId, user } = useAuth();
  const { can } = usePermission();

  const [selectedTenantId, setSelectedTenantId] = useState(activeTenantId ?? '');
  const [rows, setRows] = useState<CmsLocale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsLocale | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const canCreate = can('system-language:create');
  const canUpdate = can('system-language:update');
  const canDelete = can('system-language:delete');

  useEffect(() => {
    if (activeTenantId && !selectedTenantId) setSelectedTenantId(activeTenantId);
  }, [activeTenantId, selectedTenantId]);

  const load = useCallback(async () => {
    if (!accessToken || !selectedTenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiSystemLocalesList(accessToken, selectedTenantId);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sistem dilleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  function openCreate(suggestion?: (typeof CATALOG_SUGGESTIONS)[number]) {
    setEditing(null);
    setForm(
      suggestion
        ? {
            code: suggestion.code,
            name: suggestion.name,
            nativeName: suggestion.nativeName,
            rtl: suggestion.rtl,
            isActive: true,
          }
        : emptyForm(),
    );
    setShowForm(true);
  }

  function openEdit(loc: CmsLocale) {
    setEditing(loc);
    setForm({
      code: loc.code,
      name: loc.name,
      nativeName: loc.nativeName,
      rtl: loc.rtl,
      isActive: loc.isActive,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!accessToken || !selectedTenantId) return;
    const code = form.code.trim().toLowerCase();
    if (!code || !form.name.trim() || !form.nativeName.trim()) {
      toast.error('Kod, ad ve yerel ad zorunludur.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiSystemLocaleUpdate(accessToken, selectedTenantId, editing.id, {
          code,
          name: form.name.trim(),
          nativeName: form.nativeName.trim(),
          rtl: form.rtl,
          isActive: form.isActive,
        });
        toast.success('Dil güncellendi');
      } else {
        await apiSystemLocaleCreate(accessToken, selectedTenantId, {
          code,
          name: form.name.trim(),
          nativeName: form.nativeName.trim(),
          isActive: form.isActive,
          rtl: form.rtl,
        });
        toast.success('Sistem dili eklendi — tüm lokasyonlarda pasif olarak görünür');
      }
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(loc: CmsLocale) {
    if (!accessToken || !selectedTenantId || !canUpdate) return;
    setActingId(loc.id);
    try {
      await apiSystemLocaleSetDefault(accessToken, selectedTenantId, loc.id);
      toast.success(`${loc.code.toUpperCase()} varsayılan dil yapıldı`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Varsayılan dil atanamadı');
    } finally {
      setActingId(null);
    }
  }

  async function handleToggleActive(loc: CmsLocale) {
    if (!accessToken || !selectedTenantId || !canUpdate) return;
    setActingId(loc.id);
    try {
      await apiSystemLocaleUpdate(accessToken, selectedTenantId, loc.id, { isActive: !loc.isActive });
      toast.success(loc.isActive ? 'Dil pasifleştirildi' : 'Dil aktifleştirildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Durum güncellenemedi');
    } finally {
      setActingId(null);
    }
  }

  async function handleDeactivate(loc: CmsLocale) {
    if (!accessToken || !selectedTenantId || !canDelete) return;
    if (!window.confirm(`"${loc.nativeName}" dilini sistemden kaldırmak istiyor musunuz?`)) return;
    setActingId(loc.id);
    try {
      await apiSystemLocaleDeactivate(accessToken, selectedTenantId, loc.id);
      toast.success('Dil pasifleştirildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dil kaldırılamadı');
    } finally {
      setActingId(null);
    }
  }

  async function moveLocale(loc: CmsLocale, direction: -1 | 1) {
    if (!accessToken || !selectedTenantId || !canUpdate) return;
    const idx = sorted.findIndex((r) => r.id === loc.id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed!);
    setActingId(loc.id);
    try {
      await apiSystemLocalesReorder(
        accessToken,
        selectedTenantId,
        next.map((r) => r.id),
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıra güncellenemedi');
    } finally {
      setActingId(null);
    }
  }

  const existingCodes = new Set(rows.map((r) => r.code));
  const suggestions = CATALOG_SUGGESTIONS.filter((s) => !existingCodes.has(s.code));

  return (
    <PageContainer>
      <PageHeader
        title="Sistem Dilleri"
        subtitle="Tenant genelinde kullanılabilir resmi dilleri yönetin. Lokasyon yöneticileri yalnızca aktif dilleri açıp kapatabilir."
        action={
          canCreate ? (
            <Button variant="primary" onClick={() => openCreate()}>
              Dil Ekle
            </Button>
          ) : undefined
        }
      />

      {user?.isSuperAdmin && tenants.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Tenant
          </label>
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', minWidth: 280 }}
          >
            <option value="">Tenant seçin…</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {!selectedTenantId ? (
        <EmptyState title="Tenant seçin" description="Sistem dillerini yönetmek için bir tenant seçin." />
      ) : loading ? (
        <LoadingState label="Sistem dilleri yükleniyor…" />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Henüz sistem dili yok"
          description="Resmi dil kataloğundan ekleyerek başlayın."
          action={
            canCreate ? (
              <Button variant="primary" onClick={() => openCreate()}>
                İlk dili ekle
              </Button>
            ) : undefined
          }
        />
      ) : (
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
              {sorted.map((loc, index) => (
                <tr key={loc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canUpdate || index === 0 || actingId !== null}
                        onClick={() => void moveLocale(loc, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canUpdate || index === sorted.length - 1 || actingId !== null}
                        onClick={() => void moveLocale(loc, 1)}
                      >
                        ↓
                      </Button>
                    </div>
                  </td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{loc.code.toUpperCase()}</td>
                  <td style={{ padding: 8 }}>{loc.name}</td>
                  <td style={{ padding: 8, color: '#6b7280' }}>{loc.nativeName}</td>
                  <td style={{ padding: 8 }}>{loc.rtl ? <Badge variant="blue">RTL</Badge> : '—'}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {loc.isActive ? <Badge variant="green">Aktif</Badge> : <Badge variant="gray">Pasif</Badge>}
                      {loc.isDefault ? <Badge variant="blue">Varsayılan</Badge> : null}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {canUpdate ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(loc)}>
                          Düzenle
                        </Button>
                      ) : null}
                      {canUpdate && !loc.isDefault && loc.isActive ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={actingId === loc.id}
                          onClick={() => void handleSetDefault(loc)}
                        >
                          Varsayılan yap
                        </Button>
                      ) : null}
                      {canUpdate && !loc.isDefault ? (
                        <Button
                          size="sm"
                          variant={loc.isActive ? 'danger' : 'primary'}
                          loading={actingId === loc.id}
                          onClick={() => void handleToggleActive(loc)}
                        >
                          {loc.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                        </Button>
                      ) : null}
                      {canDelete && !loc.isDefault ? (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={actingId === loc.id}
                          onClick={() => void handleDeactivate(loc)}
                        >
                          Kaldır
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {suggestions.length > 0 && canCreate && selectedTenantId ? (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Hızlı ekle</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {suggestions.map((s) => (
              <Button key={s.code} size="sm" variant="secondary" onClick={() => openCreate(s)}>
                {s.code.toUpperCase()} — {s.nativeName}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>
              {editing ? 'Sistem dilini düzenle' : 'Sistem dili ekle'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13 }}>
                Kod (ISO)
                <input
                  value={form.code}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="tr"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Ad
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Yerel ad
                <input
                  value={form.nativeName}
                  onChange={(e) => setForm((f) => ({ ...f, nativeName: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.rtl}
                  onChange={(e) => setForm((f) => ({ ...f, rtl: e.target.checked }))}
                />
                Sağdan sola (RTL)
              </label>
              {!editing ? (
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Sistemde aktif
                </label>
              ) : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <Button variant="secondary" disabled={saving} onClick={() => setShowForm(false)}>
                İptal
              </Button>
              <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
