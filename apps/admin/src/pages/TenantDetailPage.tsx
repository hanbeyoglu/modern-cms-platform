import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import {
  apiTenantGet,
  apiTenantUpdate,
  apiTenantUpdateStatus,
  type CmsTenant,
  type TenantStatus,
  type UpdateTenantPayload,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  SUSPENDED: 'Askıya Alındı',
  PENDING: 'Beklemede',
  ARCHIVED: 'Arşivlendi',
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#16a34a',
  SUSPENDED: '#dc2626',
  PENDING: '#d97706',
  ARCHIVED: '#6b7280',
};

const LOCATION_TYPE_LABELS: Record<string, string> = {
  SHOPPING_MALL: 'AVM', STORE: 'Mağaza', MARKET: 'Market', HOTEL: 'Otel',
  HOSPITAL: 'Hastane', CAMPUS: 'Kampüs', OFFICE: 'Ofis', RESTAURANT: 'Restoran',
  MARINA: 'Marina', RESIDENCE: 'Konut', AIRPORT: 'Havalimanı', CUSTOM: 'Özel',
};

const MALL_STATUS_LABELS: Record<string, string> = {
  LIVE: 'Yayında', DRAFT: 'Taslak', MAINTENANCE: 'Bakımda', CLOSED: 'Kapalı',
};
const MALL_STATUS_COLORS: Record<string, string> = {
  LIVE: '#16a34a', DRAFT: '#d97706', MAINTENANCE: '#d97706', CLOSED: '#6b7280',
};

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<CmsTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateTenantPayload>({});
  const [saving, setSaving] = useState(false);

  const reload = () => {
    if (!accessToken || !id) return;
    setLoading(true);
    apiTenantGet(accessToken, id)
      .then((t) => { setTenant(t); setEditForm({ name: t.name, legalName: t.legalName ?? '', contactEmail: t.contactEmail ?? '', contactPhone: t.contactPhone ?? '', websiteUrl: t.websiteUrl ?? '', billingEmail: t.billingEmail ?? '' }); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [accessToken, id]);

  const handleSave = async () => {
    if (!accessToken || !id) return;
    setSaving(true);
    try {
      await apiTenantUpdate(accessToken, id, editForm);
      toast.success('Müşteri güncellendi');
      setEditing(false);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (status: TenantStatus) => {
    if (!accessToken || !id) return;
    if (!confirm(`Durum "${STATUS_LABELS[status]}" olarak değiştirilsin mi?`)) return;
    try {
      await apiTenantUpdateStatus(accessToken, id, status);
      toast.success('Durum güncellendi');
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading) return <PageContainer><div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div></PageContainer>;
  if (!tenant) return <PageContainer><div style={{ color: '#dc2626' }}>Müşteri bulunamadı</div></PageContainer>;

  const isSA = currentUser?.isSuperAdmin;

  return (
    <PageContainer>
      <PageHeader
        title={tenant.name}
        subtitle={tenant.slug}
        action={
          <button onClick={() => navigate('/tenants')} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
            ← Geri
          </button>
        }
      />

      {/* Basic Info Card */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Temel Bilgiler</div>
          {isSA && !editing && (
            <button onClick={() => setEditing(true)} style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fff' }}>Düzenle</button>
          )}
        </div>

        {editing ? (
          <div>
            {([
              ['name', 'Ad *'],
              ['legalName', 'Yasal Unvan'],
              ['contactEmail', 'İletişim E-posta'],
              ['contactPhone', 'Telefon'],
              ['websiteUrl', 'Web Sitesi'],
              ['billingEmail', 'Fatura E-posta'],
            ] as const).map(([field, label]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  value={(editForm as Record<string, string>)[field] ?? ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditing(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>İptal</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 16px', fontSize: 13 }}>
            <span style={{ color: '#6b7280' }}>Ad</span><span style={{ fontWeight: 500 }}>{tenant.name}</span>
            <span style={{ color: '#6b7280' }}>Slug</span><span>{tenant.slug}</span>
            <span style={{ color: '#6b7280' }}>Yasal Unvan</span><span>{tenant.legalName ?? '—'}</span>
            <span style={{ color: '#6b7280' }}>İletişim E-posta</span><span>{tenant.contactEmail ?? '—'}</span>
            <span style={{ color: '#6b7280' }}>Telefon</span><span>{tenant.contactPhone ?? '—'}</span>
            <span style={{ color: '#6b7280' }}>Web Sitesi</span><span>{tenant.websiteUrl ?? '—'}</span>
            <span style={{ color: '#6b7280' }}>Fatura E-posta</span><span>{tenant.billingEmail ?? '—'}</span>
            <span style={{ color: '#6b7280' }}>Durum</span>
            <span style={{ color: STATUS_COLORS[tenant.status], fontWeight: 600 }}>{STATUS_LABELS[tenant.status] ?? tenant.status}</span>
            <span style={{ color: '#6b7280' }}>Oluşturulma</span><span>{new Date(tenant.createdAt).toLocaleDateString('tr-TR')}</span>
          </div>
        )}
      </div>

      {/* Status Actions */}
      {isSA && !editing && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 12 }}>Durum Yönetimi</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['ACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED'] as TenantStatus[])
              .filter((s) => s !== tenant.status)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: s === 'ACTIVE' ? '#f0fdf4' : s === 'SUSPENDED' || s === 'ARCHIVED' ? '#fef2f2' : '#fffbeb',
                    color: s === 'ACTIVE' ? '#16a34a' : s === 'SUSPENDED' || s === 'ARCHIVED' ? '#dc2626' : '#d97706',
                  }}
                >
                  {STATUS_LABELS[s]} Yap
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Locations */}
      {tenant.malls && tenant.malls.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 12 }}>
            Lokasyonlar ({tenant.malls.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tenant.malls.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid #f3f4f6', borderRadius: 6 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {LOCATION_TYPE_LABELS[m.type] ?? m.type}{m.city ? ` · ${m.city}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: `${MALL_STATUS_COLORS[m.status] ?? '#6b7280'}22`,
                    color: MALL_STATUS_COLORS[m.status] ?? '#6b7280',
                  }}>{MALL_STATUS_LABELS[m.status] ?? m.status}</span>
                  <button
                    onClick={() => navigate(`/locations/${m.id}`)}
                    style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fff' }}
                  >
                    Detay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capabilities */}
      {tenant.capabilities && tenant.capabilities.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 12 }}>Yetenekler</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tenant.capabilities.map((c) => (
              <span key={c.capability.code} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: c.enabled ? '#f0fdf4' : '#f9fafb',
                color: c.enabled ? '#16a34a' : '#9ca3af',
                border: `1px solid ${c.enabled ? '#bbf7d0' : '#e5e7eb'}`,
              }}>
                {c.capability.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
