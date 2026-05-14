import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { apiUsersList, apiUserCreate, type CmsUser, type CreateUserPayload } from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  DISABLED: 'Pasif',
  INVITED: 'Davetli',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#16a34a',
  DISABLED: '#dc2626',
  INVITED: '#d97706',
};

export function UsersPage() {
  const { accessToken, user, tenants, activeTenantId } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [users, setUsers] = useState<CmsUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTenantId, setFilterTenantId] = useState(user?.isSuperAdmin ? '' : (activeTenantId ?? ''));
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    tenantId: activeTenantId ?? '',
    roleId: '',
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    apiUsersList(accessToken, {
      search: search || undefined,
      status: filterStatus || undefined,
      tenantId: filterTenantId || undefined,
    })
      .then((d) => setUsers(d.users))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, search, filterStatus, filterTenantId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!accessToken) return;
    setCreating(true);
    try {
      await apiUserCreate(accessToken, createForm);
      toast.success('Kullanıcı oluşturuldu');
      setShowCreate(false);
      setCreateForm({ email: '', firstName: '', lastName: '', password: '', tenantId: activeTenantId ?? '', roleId: '' });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Kullanıcılar" subtitle="Platform kullanıcılarını yönetin" />

      {/* Filters */}
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
          <option value="ACTIVE">Aktif</option>
          <option value="DISABLED">Pasif</option>
          <option value="INVITED">Davetli</option>
        </select>
        {user?.isSuperAdmin && (
          <select
            value={filterTenantId}
            onChange={(e) => setFilterTenantId(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
          >
            <option value="">Tüm Tenantlar</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {can('user:create') && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto', padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Kullanıcı Oluştur
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 440, maxWidth: '90vw' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Kullanıcı Oluştur</div>
            {([
              ['email', 'E-posta *', 'text'],
              ['firstName', 'Ad', 'text'],
              ['lastName', 'Soyad', 'text'],
              ['password', 'Şifre *', 'password'],
            ] as const).map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={createForm[field] ?? ''}
                  onChange={(e) => setCreateForm((p) => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {user?.isSuperAdmin && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tenant</label>
                <select
                  value={createForm.tenantId ?? ''}
                  onChange={(e) => setCreateForm((p) => ({ ...p, tenantId: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">— Seçiniz —</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>İptal</button>
              <button onClick={handleCreate} disabled={creating} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {creating ? 'Oluşturuluyor…' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>Kullanıcı bulunamadı</div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Ad Soyad', 'E-posta', 'Tenant / Rol', 'Durum', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500, color: '#111827' }}>
                      {u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '—'}
                    </div>
                    {u.isSuperAdmin && <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>Super Admin</div>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{u.email}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.memberships.slice(0, 2).map((m) => (
                      <div key={m.id} style={{ fontSize: 12, color: '#6b7280' }}>
                        <span style={{ color: '#111827', fontWeight: 500 }}>{m.tenantName}</span>
                        {' · '}{m.role.name}
                      </div>
                    ))}
                    {u.memberships.length > 2 && (
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>+{u.memberships.length - 2} daha</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${STATUS_COLORS[u.status]}22`,
                      color: STATUS_COLORS[u.status],
                    }}>
                      {STATUS_LABELS[u.status] ?? u.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/users/${u.id}`)}
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
