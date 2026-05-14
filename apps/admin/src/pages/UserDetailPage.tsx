import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import {
  apiUserGet,
  apiUserUpdateStatus,
  apiUserAddMembership,
  apiUserUpdateMembership,
  apiUserRemoveMembership,
  apiRolesList,
  apiUserResetPassword,
  type CmsUser,
  type CmsRole,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Aktif', DISABLED: 'Pasif', INVITED: 'Davetli' };
const STATUS_COLORS: Record<string, string> = { ACTIVE: '#16a34a', DISABLED: '#dc2626', INVITED: '#d97706' };

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user: currentUser, tenants } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [user, setUser] = useState<CmsUser | null>(null);
  const [roles, setRoles] = useState<CmsRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMembership, setShowAddMembership] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ tenantId: '', roleId: '', mallIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const reload = () => {
    if (!accessToken || !id) return;
    setLoading(true);
    Promise.all([
      apiUserGet(accessToken, id),
      apiRolesList(accessToken),
    ])
      .then(([u, r]) => { setUser(u); setRoles(r.roles); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [accessToken, id]);

  const handleStatusToggle = async () => {
    if (!accessToken || !user) return;
    const next = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await apiUserUpdateStatus(accessToken, user.id, next);
      toast.success(`Kullanıcı ${next === 'ACTIVE' ? 'etkinleştirildi' : 'devre dışı bırakıldı'}`);
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleAddMembership = async () => {
    if (!accessToken || !user) return;
    setSaving(true);
    try {
      await apiUserAddMembership(accessToken, user.id, membershipForm);
      toast.success('Üyelik eklendi');
      setShowAddMembership(false);
      setMembershipForm({ tenantId: '', roleId: '', mallIds: [] });
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleRemoveMembership = async (membershipId: string) => {
    if (!accessToken || !user) return;
    if (!confirm('Bu üyeliği kaldırmak istediğinizden emin misiniz?')) return;
    try {
      await apiUserRemoveMembership(accessToken, user.id, membershipId);
      toast.success('Üyelik kaldırıldı');
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleToggleMembershipActive = async (membershipId: string, isActive: boolean) => {
    if (!accessToken || !user) return;
    try {
      await apiUserUpdateMembership(accessToken, user.id, membershipId, { isActive: !isActive });
      toast.success('Üyelik güncellendi');
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleResetPassword = async () => {
    if (!accessToken || !user) return;
    try {
      await apiUserResetPassword(accessToken, user.id);
      toast.success('Şifre sıfırlama isteği oluşturuldu');
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading) return <PageContainer><div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div></PageContainer>;
  if (!user) return <PageContainer><div style={{ color: '#dc2626' }}>Kullanıcı bulunamadı</div></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title={user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : user.email}
        subtitle={user.email}
        action={
          <button onClick={() => navigate('/users')} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
            ← Geri
          </button>
        }
      />

      {/* Profile card */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 12 }}>Profil</div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>E-posta</span><span>{user.email}</span>
              <span style={{ color: '#6b7280' }}>Ad</span><span>{user.firstName ?? '—'}</span>
              <span style={{ color: '#6b7280' }}>Soyad</span><span>{user.lastName ?? '—'}</span>
              <span style={{ color: '#6b7280' }}>Durum</span>
              <span style={{ color: STATUS_COLORS[user.status], fontWeight: 600 }}>{STATUS_LABELS[user.status]}</span>
              {user.isSuperAdmin && (
                <><span style={{ color: '#6b7280' }}>Rol</span><span style={{ color: '#7c3aed', fontWeight: 600 }}>Super Admin</span></>
              )}
              <span style={{ color: '#6b7280' }}>Oluşturulma</span><span>{new Date(user.createdAt).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>
          {can('user:update') && user.id !== currentUser?.id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleStatusToggle}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: user.status === 'ACTIVE' ? '#fef2f2' : '#f0fdf4',
                  color: user.status === 'ACTIVE' ? '#dc2626' : '#16a34a',
                }}
              >
                {user.status === 'ACTIVE' ? 'Devre Dışı Bırak' : 'Etkinleştir'}
              </button>
              <button
                onClick={handleResetPassword}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, cursor: 'pointer', background: '#fff' }}
              >
                Şifre Sıfırla
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Memberships */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Üyelikler</div>
          {can('user:create') && (
            <button
              onClick={() => setShowAddMembership(true)}
              style={{ padding: '5px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Üyelik Ekle
            </button>
          )}
        </div>

        {user.memberships.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Üyelik yok</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {user.memberships.map((m) => (
              <div key={m.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.tenantName}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {m.role.name}
                    {m.malls.length > 0 && ` · ${m.malls.map((ml) => ml.name).join(', ')}`}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
                      background: m.isActive ? '#f0fdf4' : '#f9fafb',
                      color: m.isActive ? '#16a34a' : '#9ca3af',
                    }}>{m.isActive ? 'Aktif' : 'Pasif'}</span>
                  </div>
                </div>
                {can('user:update') && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleToggleMembershipActive(m.id, m.isActive)}
                      style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fff' }}
                    >
                      {m.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                    </button>
                    {can('user:delete') && (
                      <button
                        onClick={() => handleRemoveMembership(m.id)}
                        style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fef2f2', color: '#dc2626' }}
                      >
                        Kaldır
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add membership modal */}
      {showAddMembership && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 400, maxWidth: '90vw' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Üyelik Ekle</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tenant *</label>
              <select
                value={membershipForm.tenantId}
                onChange={(e) => setMembershipForm((p) => ({ ...p, tenantId: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              >
                <option value="">— Seçiniz —</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Rol *</label>
              <select
                value={membershipForm.roleId}
                onChange={(e) => setMembershipForm((p) => ({ ...p, roleId: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              >
                <option value="">— Seçiniz —</option>
                {roles.filter((r) => r.isActive).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowAddMembership(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>İptal</button>
              <button onClick={handleAddMembership} disabled={saving || !membershipForm.tenantId || !membershipForm.roleId} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Ekleniyor…' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
