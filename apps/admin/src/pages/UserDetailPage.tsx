import { useCallback, useEffect, useState } from 'react';
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
  apiMalls,
  type Mall,
  apiUserResetPassword,
  type CmsUser,
  type CmsRole,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { AuditTimeline } from '../components/AuditTimeline';

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
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [membershipMalls, setMembershipMalls] = useState<Mall[]>([]);
  const [membershipMallsLoading, setMembershipMallsLoading] = useState(false);
  const [membershipMallsError, setMembershipMallsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const reload = useCallback(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    Promise.all([
      apiUserGet(accessToken, id),
      apiRolesList(accessToken),
    ])
      .then(([u, r]) => { setUser(u); setRoles(r.roles); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!showAddMembership || !accessToken || !membershipForm.tenantId) {
      setMembershipMalls([]);
      return;
    }
    let cancelled = false;
    setMembershipMallsLoading(true);
    setMembershipMallsError(false);
    setMembershipMalls([]);
    void apiMalls(accessToken, membershipForm.tenantId)
      .then(data => { if (!cancelled) setMembershipMalls(data.malls); })
      .catch(() => { if (!cancelled) setMembershipMallsError(true); })
      .finally(() => { if (!cancelled) setMembershipMallsLoading(false); });
    return () => { cancelled = true; };
  }, [showAddMembership, accessToken, membershipForm.tenantId]);

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
      if (editingMembershipId) {
        await apiUserUpdateMembership(accessToken, user.id, editingMembershipId, {
          roleId: membershipForm.roleId, mallIds: membershipForm.mallIds,
        });
      } else {
        await apiUserAddMembership(accessToken, user.id, membershipForm);
      }
      toast.success(editingMembershipId ? 'Üyelik güncellendi' : 'Üyelik eklendi');
      setEditingMembershipId(null);
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
    if (newPassword.length < 8 || newPassword.length > 72) {
      toast.error('Şifre 8–72 karakter arasında olmalıdır');
      return;
    }
    setResettingPassword(true);
    try {
      const result = await apiUserResetPassword(accessToken, user.id, newPassword);
      toast.success(result.message);
      setNewPassword('');
      setShowPasswordReset(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setResettingPassword(false); }
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
                onClick={() => setShowPasswordReset(true)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, cursor: 'pointer', background: '#fff' }}
              >
                Şifre Sıfırla
              </button>
            </div>
          )}
        </div>
      </div>

      {showPasswordReset && can('user:update') && (
        <form onSubmit={(e) => { e.preventDefault(); void handleResetPassword(); }} style={{ marginBottom: 20 }}>
          <label htmlFor="reset-password">Yeni şifre</label>
          <input id="reset-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={resettingPassword} />
          <p>Yeni şifreyi kullanıcıya güvenli bir kanaldan iletin. Mevcut oturumların yenilenmesi engellenir.</p>
          <button type="submit" disabled={resettingPassword}>{resettingPassword ? 'Kaydediliyor…' : 'Şifreyi değiştir'}</button>
          <button type="button" disabled={resettingPassword} onClick={() => { setShowPasswordReset(false); setNewPassword(''); }}>Vazgeç</button>
        </form>
      )}

      {/* Memberships */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Üyelikler</div>
          {can('user:create') && (
            <button
              onClick={() => { setEditingMembershipId(null); setMembershipForm({ tenantId: '', roleId: '', mallIds: [] }); setShowAddMembership(true); }}
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
                    <button type="button" onClick={() => {
                      const role = roles.find(role => role.id === m.role.id);
                      if (!role) { toast.error('Üyeliğin rol bilgisi yüklenemedi'); return; }
                      setEditingMembershipId(m.id);
                      setMembershipForm({ tenantId: m.tenantId, roleId: role.id, mallIds: m.malls.map(mall => mall.id) });
                      setShowAddMembership(true);
                    }} style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 5, background: '#fff', cursor: 'pointer' }}>AVM erişimini düzenle</button>
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
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editingMembershipId ? 'Üyeliği ve AVM erişimini düzenle' : 'Üyelik Ekle'}</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tenant *</label>
              <select
                value={membershipForm.tenantId}
                disabled={saving || !!editingMembershipId}
                onChange={(e) => setMembershipForm((p) => ({ ...p, tenantId: e.target.value, roleId: '', mallIds: [] }))}
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
                {roles.filter((r) => r.isActive && (r.tenantId === null || r.tenantId === membershipForm.tenantId)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <fieldset disabled={saving || membershipMallsLoading} style={{ border: '1px solid #e2e8f0', borderRadius: 8, margin: '16px 0', padding: 12 }}>
              <legend>AVM erişimi</legend>
              {roles.find(role => role.id === membershipForm.roleId)?.code === 'TENANT_ADMIN' ? (
                <p>Müşteri yöneticisi bu müşterinin tüm AVM’lerine erişir.</p>
              ) : <>
                <p style={{ fontSize: 13 }}>Kullanıcının çalışabileceği AVM’leri seçin. Tek AVM girişte otomatik seçilir; birden fazlaysa kullanıcı seçim yapar.</p>
                {membershipMallsLoading ? <p role="status">AVM’ler yükleniyor…</p> : membershipMallsError ? <p role="alert">AVM listesi yüklenemedi. Formu kapatıp tekrar deneyin.</p> : membershipMalls.length === 0 ? <p>Bu müşteri için seçilebilir AVM yok.</p> : membershipMalls.map(mall => (
                  <label key={mall.id} style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
                    <input type="checkbox" checked={membershipForm.mallIds.includes(mall.id)} onChange={event => setMembershipForm(previous => ({ ...previous, mallIds: event.target.checked ? [...previous.mallIds, mall.id] : previous.mallIds.filter(id => id !== mall.id) }))} />
                    {mall.name}
                  </label>
                ))}
                {!membershipForm.mallIds.length && <p style={{ color: '#b45309', fontSize: 13 }}>AVM seçilmezse kullanıcı AVM içeriklerini yönetemez.</p>}
              </>}
            </fieldset>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowAddMembership(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>İptal</button>
              <button onClick={handleAddMembership} disabled={saving || membershipMallsLoading || membershipMallsError || !membershipForm.tenantId || !membershipForm.roleId} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Kaydediliyor…' : editingMembershipId ? 'Kaydet' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {user && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '20px 24px',
            marginTop: 24,
          }}
        >
          <AuditTimeline entityType="user" entityId={user.id} />
        </div>
      )}
    </PageContainer>
  );
}
