import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import {
  apiServiceCreate,
  apiServiceDelete,
  apiServiceUpdate,
  apiServicesList,
  type CmsService,
  type CreateServicePayload,
  type ServiceStatus,
} from '../lib/api';
import { usePermission } from '../hooks/usePermission';
import { useMallRequired } from '../hooks/useMallRequired';
import { LocationScopedModuleShell } from '../components/location-scoped/LocationScopedModuleShell';

const STATUS_STYLE: Record<ServiceStatus, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#d1fae5', color: '#065f46', label: 'Aktif' },
  INACTIVE: { bg: '#f3f4f6', color: '#374151', label: 'Pasif' },
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  const c = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

type FormState = {
  name: string;
  description: string;
  iconMediaId: string;
  coverMediaId: string;
  iconMediaWidthOverride: string;
  iconMediaHeightOverride: string;
  coverMediaWidthOverride: string;
  coverMediaHeightOverride: string;
  category: string;
  floor: string;
  unitNo: string;
  phone: string;
  email: string;
  websiteUrl: string;
  locationLabel: string;
  searchTagsText: string;
  isSoon: boolean;
  sortOrder: string;
  status: ServiceStatus;
};

const EMPTY: FormState = {
  name: '',
  description: '',
  iconMediaId: '',
  coverMediaId: '',
  iconMediaWidthOverride: '',
  iconMediaHeightOverride: '',
  coverMediaWidthOverride: '',
  coverMediaHeightOverride: '',
  category: '',
  floor: '',
  unitNo: '',
  phone: '',
  email: '',
  websiteUrl: '',
  locationLabel: '',
  searchTagsText: '',
  isSoon: false,
  sortOrder: '0',
  status: 'ACTIVE',
};

function toForm(s: CmsService): FormState {
  return {
    name: s.name,
    description: s.description ?? '',
    iconMediaId: s.iconMediaId ?? '',
    coverMediaId: s.coverMediaId ?? '',
    iconMediaWidthOverride: s.iconMediaWidthOverride ? String(s.iconMediaWidthOverride) : '',
    iconMediaHeightOverride: s.iconMediaHeightOverride ? String(s.iconMediaHeightOverride) : '',
    coverMediaWidthOverride: s.coverMediaWidthOverride ? String(s.coverMediaWidthOverride) : '',
    coverMediaHeightOverride: s.coverMediaHeightOverride ? String(s.coverMediaHeightOverride) : '',
    category: s.category ?? '',
    floor: s.floor ?? '',
    unitNo: s.unitNo ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    websiteUrl: s.websiteUrl ?? '',
    locationLabel: s.locationLabel ?? '',
    searchTagsText: s.searchTags?.join(', ') ?? '',
    isSoon: s.isSoon,
    sortOrder: String(s.sortOrder),
    status: s.status,
  };
}

function parseSearchTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseOptionalDimension(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toPayload(f: FormState): CreateServicePayload {
  return {
    name: f.name,
    description: f.description || undefined,
    iconMediaId: f.iconMediaId || undefined,
    coverMediaId: f.coverMediaId || undefined,
    iconMediaWidthOverride: parseOptionalDimension(f.iconMediaWidthOverride),
    iconMediaHeightOverride: parseOptionalDimension(f.iconMediaHeightOverride),
    coverMediaWidthOverride: parseOptionalDimension(f.coverMediaWidthOverride),
    coverMediaHeightOverride: parseOptionalDimension(f.coverMediaHeightOverride),
    category: f.category || undefined,
    floor: f.floor || undefined,
    unitNo: f.unitNo || undefined,
    phone: f.phone || undefined,
    email: f.email || undefined,
    websiteUrl: f.websiteUrl || undefined,
    locationLabel: f.locationLabel || undefined,
    searchTags: parseSearchTags(f.searchTagsText),
    isSoon: f.isSoon,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
  };
}

export function ServicesPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const { can } = usePermission();
  const [rows, setRows] = useState<CmsService[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ServiceStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsService | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';

  const load = useCallback(async () => {
    if (!accessToken || mallCtx.status !== 'ready') return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiServicesList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setRows(data.services);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hizmetler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, mallCtx.status, tenantId, mallId, filterStatus, filterSearch]);

  useEffect(() => {
    void load();
  }, [load]);


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

  async function handleSubmit() {
    if (!accessToken || !tenantId || !mallId) return;
    if (!form.name.trim()) {
      setFormError('Ad zorunludur.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editing) {
        const u = await apiServiceUpdate(accessToken, tenantId, editing.id, payload);
        setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)));
        toast.success('Hizmet güncellendi');
      } else {
        const c = await apiServiceCreate(accessToken, tenantId, payload, mallId);
        setRows((prev) => [c, ...prev]);
        setTotal((t) => t + 1);
        toast.success('Hizmet oluşturuldu');
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm('Bu hizmet silinsin mi?')) return;
    try {
      await apiServiceDelete(accessToken, tenantId, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      toast.success('Hizmet silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  return (
    <LocationScopedModuleShell
      title="Hizmetler"
      meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} kayıt</span>}
      headerAction={
        can('service:create') ? (
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY);
              setFormError(null);
              setShowForm(true);
            }}
          >
            + Yeni Hizmet
          </Button>
        ) : undefined
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
            onChange={(e) => setFilterStatus(e.target.value as ServiceStatus | '')}
            style={{ ...inputStyle, width: 160 }}
          >
            <option value="">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Pasif</option>
          </select>
        </label>
      }
    >
      <div style={{ fontSize: 13 }}>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {loading && <LoadingState />}

        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20, background: '#fafafa' }}>
            <h3 style={{ marginTop: 0 }}>{editing ? 'Hizmet düzenle' : 'Yeni hizmet'}</h3>
            {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 720 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Ad *</label>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Açıklama</label>
                <textarea style={inputStyle} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <ContextualMediaPicker
                  context="SERVICE_ICON"
                  value={form.iconMediaId}
                  mallId={mallId}
                  onChange={(id) => setForm({ ...form, iconMediaId: id })}
                  dimensionOverride={{
                    width: parseOptionalDimension(form.iconMediaWidthOverride),
                    height: parseOptionalDimension(form.iconMediaHeightOverride),
                  }}
                  onDimensionOverrideChange={(dimensions) => setForm({
                    ...form,
                    iconMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                    iconMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                  })}
                />
              </div>
              <div>
                <ContextualMediaPicker
                  context="SERVICE_COVER"
                  value={form.coverMediaId}
                  mallId={mallId}
                  onChange={(id) => setForm({ ...form, coverMediaId: id })}
                  dimensionOverride={{
                    width: parseOptionalDimension(form.coverMediaWidthOverride),
                    height: parseOptionalDimension(form.coverMediaHeightOverride),
                  }}
                  onDimensionOverrideChange={(dimensions) => setForm({
                    ...form,
                    coverMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                    coverMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                  })}
                />
              </div>
              <div>
                <label style={labelStyle}>Kategori</label>
                <input style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Kat</label>
                <input style={inputStyle} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Ünite no</label>
                <input style={inputStyle} value={form.unitNo} onChange={(e) => setForm({ ...form, unitNo: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Telefon</label>
                <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>E-posta</label>
                <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Web sitesi</label>
                <input style={inputStyle} value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Konum etiketi</label>
                <input style={inputStyle} value={form.locationLabel} onChange={(e) => setForm({ ...form, locationLabel: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Arama etiketleri (virgülle)</label>
                <input
                  style={inputStyle}
                  value={form.searchTagsText}
                  onChange={(e) => setForm({ ...form, searchTagsText: e.target.value })}
                  placeholder="ör. wc, atm, vale"
                />
              </div>
              <div>
                <label style={labelStyle}>Sıra</label>
                <input type="number" style={inputStyle} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Durum</label>
                <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ServiceStatus })}>
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Pasif</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'end' }}>
                <input type="checkbox" checked={form.isSoon} onChange={(e) => setForm({ ...form, isSoon: e.target.checked })} />
                Yakında açılacak
              </label>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>
                İptal
              </Button>
            </div>
          </div>
        )}

        {!loading && rows.length === 0 && !showForm && (
          <EmptyState title="Hizmet yok" description="WC, ATM, vale gibi hizmetler ekleyin." />
        )}

        {rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: 8 }}>Ad</th>
                <th style={{ padding: 8 }}>Kategori</th>
                <th style={{ padding: 8 }}>Durum</th>
                <th style={{ padding: 8 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>
                    {s.name}
                    {s.isSoon && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#b45309' }}>Yakında</span>
                    )}
                  </td>
                  <td style={{ padding: 8, color: '#6b7280' }}>{s.category ?? '—'}</td>
                  <td style={{ padding: 8 }}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    {can('service:update') && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setForm(toForm(s));
                          setFormError(null);
                          setShowForm(true);
                        }}
                      >
                        Düzenle
                      </Button>
                    )}
                    {can('service:delete') && (
                      <Button variant="ghost" onClick={() => void handleDelete(s.id)}>
                        Sil
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </LocationScopedModuleShell>
  );
}
