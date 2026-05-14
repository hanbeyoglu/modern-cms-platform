import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import {
  apiLocationsList,
  apiLocationCreate,
  LOCATION_TYPE_LABELS,
  type CmsLocation,
  type CreateLocationPayload,
  type LocationType,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

const STATUS_LABELS: Record<string, string> = {
  LIVE: 'Yayında', DRAFT: 'Taslak', MAINTENANCE: 'Bakımda', CLOSED: 'Kapalı',
};
const STATUS_COLORS: Record<string, string> = {
  LIVE: '#16a34a', DRAFT: '#d97706', MAINTENANCE: '#d97706', CLOSED: '#6b7280',
};

const INIT_FORM: CreateLocationPayload = {
  name: '',
  tenantId: '',
  type: 'SHOPPING_MALL',
  isPublic: true,
};

export function LocationsPage() {
  const { accessToken, user, tenants, activeTenantId } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [locations, setLocations] = useState<CmsLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTenantId, setFilterTenantId] = useState(user?.isSuperAdmin ? '' : (activeTenantId ?? ''));
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateLocationPayload>({ ...INIT_FORM, tenantId: activeTenantId ?? '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    apiLocationsList(accessToken, {
      search: search || undefined,
      type: filterType || undefined,
      status: filterStatus || undefined,
      tenantId: filterTenantId || undefined,
    })
      .then((d) => setLocations(d.locations))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, search, filterType, filterStatus, filterTenantId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!accessToken) return;
    if (!form.tenantId) { toast.error('Tenant seçiniz'); return; }
    setCreating(true);
    try {
      const loc = await apiLocationCreate(accessToken, form);
      toast.success('Lokasyon oluşturuldu');
      setShowCreate(false);
      setForm({ ...INIT_FORM, tenantId: activeTenantId ?? '' });
      navigate(`/locations/${loc.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Lokasyonlar" subtitle="Tüm lokasyon ve mekanları yönetin" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          placeholder="İsim ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, minWidth: 200 }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
          <option value="">Tüm Tipler</option>
          {Object.entries(LOCATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {user?.isSuperAdmin && (
          <select value={filterTenantId} onChange={(e) => setFilterTenantId(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
            <option value="">Tüm Müşteriler</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {can('location:create') && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto', padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Lokasyon Ekle
          </button>
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Lokasyon Ekle</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Ad *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tip</label>
              <select value={form.type ?? 'SHOPPING_MALL'} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as LocationType }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                {Object.entries(LOCATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {user?.isSuperAdmin && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Müşteri *</label>
                <select value={form.tenantId} onChange={(e) => setForm((p) => ({ ...p, tenantId: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                  <option value="">— Seçiniz —</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {([
              ['displayName', 'Görünen Ad'],
              ['city', 'Şehir'],
              ['phone', 'Telefon'],
              ['websiteUrl', 'Web Sitesi'],
            ] as const).map(([field, label]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                <input value={(form as unknown as Record<string, string>)[field] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>İptal</button>
              <button onClick={handleCreate} disabled={creating || !form.name || !form.tenantId}
                style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {creating ? 'Oluşturuluyor…' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : locations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>Lokasyon bulunamadı</div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Lokasyon', 'Tip', 'Şehir', 'Müşteri', 'Durum', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{loc.displayName ?? loc.name}</div>
                    {loc.displayName && <div style={{ fontSize: 11, color: '#6b7280' }}>{loc.name}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>
                    {LOCATION_TYPE_LABELS[loc.type] ?? loc.type}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{loc.city ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>
                    {loc.tenant?.name ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                      fontSize: 11, fontWeight: 600,
                      background: `${STATUS_COLORS[loc.status] ?? '#9ca3af'}22`,
                      color: STATUS_COLORS[loc.status] ?? '#6b7280',
                    }}>
                      {STATUS_LABELS[loc.status] ?? loc.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/locations/${loc.id}`)}
                      style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fff' }}
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
