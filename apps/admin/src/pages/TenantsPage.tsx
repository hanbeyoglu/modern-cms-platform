import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { apiTenantsList, apiTenantCreate, type CmsTenant, type CreateTenantPayload } from '../lib/api';
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

const INIT_FORM: CreateTenantPayload = {
  name: '',
  slug: '',
  legalName: '',
  contactEmail: '',
  contactPhone: '',
  websiteUrl: '',
  billingEmail: '',
  status: 'ACTIVE',
};

export function TenantsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<CmsTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateTenantPayload>(INIT_FORM);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    apiTenantsList(accessToken, { search: search || undefined, status: filterStatus || undefined })
      .then((d) => setTenants(d.tenants))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  if (!user?.isSuperAdmin) {
    return (
      <PageContainer>
        <PageHeader title="Müşteriler" subtitle="Erişim reddedildi" />
        <div style={{ color: '#dc2626', fontSize: 13 }}>Bu sayfayı yalnızca Super Admin görebilir.</div>
      </PageContainer>
    );
  }

  const handleCreate = async () => {
    if (!accessToken) return;
    setCreating(true);
    try {
      await apiTenantCreate(accessToken, form);
      toast.success('Müşteri oluşturuldu');
      setShowCreate(false);
      setForm(INIT_FORM);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Müşteriler" subtitle="Platform müşterilerini yönetin" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          placeholder="İsim veya e-posta ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, minWidth: 200 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        >
          <option value="">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          onClick={() => setShowCreate(true)}
          style={{ marginLeft: 'auto', padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Müşteri Oluştur
        </button>
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Müşteri Oluştur</div>
            {([
              ['name', 'Ad *', 'text'],
              ['slug', 'Slug (opsiyonel)', 'text'],
              ['legalName', 'Yasal Unvan', 'text'],
              ['contactEmail', 'İletişim E-posta', 'email'],
              ['contactPhone', 'İletişim Telefon', 'text'],
              ['websiteUrl', 'Web Sitesi', 'text'],
              ['billingEmail', 'Fatura E-posta', 'email'],
            ] as const).map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, string>)[field] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Durum</label>
              <select
                value={form.status ?? 'ACTIVE'}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CreateTenantPayload['status'] }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>İptal</button>
              <button onClick={handleCreate} disabled={creating || !form.name} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {creating ? 'Oluşturuluyor…' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : tenants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>Müşteri bulunamadı</div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Ad / Slug', 'Yasal Unvan', 'İletişim', 'Durum', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{t.legalName ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, color: '#374151' }}>{t.contactEmail ?? '—'}</div>
                    {t.contactPhone && <div style={{ fontSize: 11, color: '#6b7280' }}>{t.contactPhone}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                      fontSize: 11, fontWeight: 600,
                      background: `${STATUS_COLORS[t.status] ?? '#9ca3af'}22`,
                      color: STATUS_COLORS[t.status] ?? '#6b7280',
                    }}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/tenants/${t.id}`)}
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
