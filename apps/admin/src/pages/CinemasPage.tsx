import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { useMallRequired } from '../hooks/useMallRequired';
import { LocationScopedModuleShell } from '../components/location-scoped/LocationScopedModuleShell';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import {
  apiCinemaCreate,
  apiCinemaDelete,
  apiCinemaUpdate,
  apiCinemasList,
  apiMediaList,
  type CinemaProviderType,
  type CinemaStatus,
  type CmsCinema,
  type CreateCinemaPayload,
  type MediaAsset,
  API_MAX_PAGE_SIZE,
} from '../lib/api';

const STATUS_STYLE: Record<CinemaStatus, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#d1fae5', color: '#065f46', label: 'Aktif' },
  PASSIVE: { bg: '#fef3c7', color: '#92400e', label: 'Pasif' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv' },
};

const PROVIDER_LABELS: Record<CinemaProviderType, string> = {
  MANUAL: 'Manuel',
  API: 'API (hazır)',
  XML_FEED: 'XML besleme (hazır)',
};

function StatusBadge({ status }: { status: CinemaStatus }) {
  const c = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

type FormState = {
  name: string;
  slug: string;
  logoMediaId: string;
  description: string;
  providerType: CinemaProviderType;
  providerConfigJson: string;
  status: CinemaStatus;
};

const EMPTY: FormState = {
  name: '',
  slug: '',
  logoMediaId: '',
  description: '',
  providerType: 'MANUAL',
  providerConfigJson: '',
  status: 'ACTIVE',
};

function toForm(c: CmsCinema): FormState {
  return {
    name: c.name,
    slug: c.slug,
    logoMediaId: c.logoMediaId ?? '',
    description: c.description ?? '',
    providerType: c.providerType,
    providerConfigJson: c.providerConfigJson ? JSON.stringify(c.providerConfigJson, null, 2) : '',
    status: c.status,
  };
}

function toPayload(f: FormState): CreateCinemaPayload {
  let providerConfigJson: Record<string, unknown> | undefined;
  const raw = f.providerConfigJson.trim();
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Sağlayıcı JSON geçerli bir nesne olmalıdır.');
    }
    providerConfigJson = parsed as Record<string, unknown>;
  }
  return {
    name: f.name,
    slug: f.slug.trim() || undefined,
    logoMediaId: f.logoMediaId || undefined,
    description: f.description || undefined,
    providerType: f.providerType,
    providerConfigJson,
    status: f.status,
  };
}

export function CinemasPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const [rows, setRows] = useState<CmsCinema[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<CinemaStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsCinema | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';

  const load = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCinemasList(accessToken, tenantId, mallId, {
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setRows(data.cinemas);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch]);

  const loadMedia = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    try {
      const data = await apiMediaList(accessToken, tenantId, { limit: API_MAX_PAGE_SIZE, mallId });
      setMediaAssets(data.assets);
    } catch {
      setMediaAssets([]);
    }
  }, [accessToken, tenantId, mallId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
  };

  return (
    <LocationScopedModuleShell
      title="Sinemalar"
      meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} kayıt</span>}
      headerAction={
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setFormError(null);
            setShowForm(true);
          }}
        >
          + Yeni Sinema
        </Button>
      }
      search={{
        value: filterSearch,
        onChange: setFilterSearch,
        placeholder: 'Ada göre ara…',
      }}
      filters={
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Durum</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CinemaStatus | '')}
            style={{ ...inputStyle, width: 160 }}
          >
            <option value="">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
            <option value="ARCHIVED">Arşiv</option>
          </select>
        </label>
      }
    >
      <div style={{ fontSize: 13 }}>
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="Sinema yok" description="Yeni sinema ekleyerek başlayın." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 4px' }}>Ad</th>
                <th style={{ padding: '8px 4px' }}>Sağlayıcı</th>
                <th style={{ padding: '8px 4px' }}>Durum</th>
                <th style={{ padding: '8px 4px' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 4px' }}>{c.name}</td>
                  <td style={{ padding: '8px 4px' }}>{PROVIDER_LABELS[c.providerType]}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(c);
                        setForm(toForm(c));
                        setFormError(null);
                        setShowForm(true);
                      }}
                    >
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        if (!accessToken || !window.confirm('Silinsin mi?')) return;
                        try {
                          await apiCinemaDelete(accessToken, tenantId, mallId, c.id);
                          setRows((prev) => prev.filter((x) => x.id !== c.id));
                          setTotal((t) => t - 1);
                          toast.success('Silindi');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Hata');
                        }
                      }}
                    >
                      Sil
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
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
              maxWidth: 480,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Sinema düzenle' : 'Yeni sinema'}</h3>
            {formError && <ErrorBanner message={formError} />}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ad</label>
            <input style={{ ...inputStyle, marginBottom: 12 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Slug (opsiyonel)</label>
            <input style={{ ...inputStyle, marginBottom: 12 }} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Logo</label>
            <select
              style={{ ...inputStyle, marginBottom: 12 }}
              value={form.logoMediaId}
              onChange={(e) => setForm({ ...form, logoMediaId: e.target.value })}
            >
              <option value="">—</option>
              {mediaAssets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.originalName}
                </option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Açıklama</label>
            <textarea style={{ ...inputStyle, minHeight: 60, marginBottom: 12 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sağlayıcı tipi</label>
            <select
              style={{ ...inputStyle, marginBottom: 12 }}
              value={form.providerType}
              onChange={(e) => setForm({ ...form, providerType: e.target.value as CinemaProviderType })}
            >
              <option value="MANUAL">Manuel</option>
              <option value="API">API</option>
              <option value="XML_FEED">XML</option>
            </select>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sağlayıcı JSON (opsiyonel)</label>
            <textarea style={{ ...inputStyle, fontFamily: 'monospace', minHeight: 80, marginBottom: 12 }} value={form.providerConfigJson} onChange={(e) => setForm({ ...form, providerConfigJson: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Durum</label>
            <select
              style={{ ...inputStyle, marginBottom: 16 }}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as CinemaStatus })}
            >
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
              <option value="ARCHIVED">Arşiv</option>
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Vazgeç
              </Button>
              <Button
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  if (!accessToken || !form.name.trim()) {
                    setFormError('Ad zorunludur.');
                    return;
                  }
                  try {
                    let payload: CreateCinemaPayload;
                    try {
                      payload = toPayload(form);
                    } catch (parseErr) {
                      setFormError(parseErr instanceof Error ? parseErr.message : 'JSON hatası');
                      setSaving(false);
                      return;
                    }
                    setSaving(true);
                    setFormError(null);
                    if (editing) {
                      const updated = await apiCinemaUpdate(accessToken, tenantId, mallId, editing.id, payload);
                      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      toast.success('Güncellendi');
                    } else {
                      const created = await apiCinemaCreate(accessToken, tenantId, mallId, payload);
                      setRows((prev) => [created, ...prev]);
                      setTotal((t) => t + 1);
                      toast.success('Oluşturuldu');
                    }
                    setShowForm(false);
                  } catch (err) {
                    setFormError(err instanceof Error ? err.message : 'Kayıt hatası');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}
    </LocationScopedModuleShell>
  );
}
