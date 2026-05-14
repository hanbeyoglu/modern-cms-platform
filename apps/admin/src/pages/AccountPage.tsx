import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { apiUpdateProfile, apiChangePassword, apiMe, apiTenants } from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

export function AccountPage() {
  const { accessToken, user, setProfile } = useAuth();
  const memberships = user?.memberships ?? [];

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!accessToken) return;
    setSavingProfile(true);
    try {
      await apiUpdateProfile(accessToken, { firstName, lastName });
      const [updated, tenantsData] = await Promise.all([apiMe(accessToken), apiTenants(accessToken)]);
      setProfile(updated, tenantsData.tenants);
      toast.success('Profil güncellendi');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!accessToken) return;
    if (newPassword !== confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Şifre en az 8 karakter olmalıdır');
      return;
    }
    setSavingPassword(true);
    try {
      await apiChangePassword(accessToken, { currentPassword, newPassword });
      toast.success('Şifre değiştirildi. Lütfen tekrar giriş yapın.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingPassword(false); }
  };

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader title="Hesabım" subtitle="Profil ve güvenlik ayarları" />

      {/* Profile */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 16 }}>Profil Bilgileri</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 480 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>Ad</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>Soyad</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginTop: 12, maxWidth: 480 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>E-posta</label>
          <input value={user.email} disabled style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: '#f9fafb', color: '#6b7280' }} />
        </div>
        {user.isSuperAdmin && (
          <div style={{ marginTop: 10, display: 'inline-block', padding: '3px 10px', background: '#f5f3ff', color: '#7c3aed', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
            Super Admin
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button onClick={handleSaveProfile} disabled={savingProfile} style={{ padding: '7px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {savingProfile ? 'Kaydediliyor…' : 'Profili Kaydet'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 16 }}>Şifre Değiştir</div>
        <div style={{ maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {([
            ['currentPassword', 'Mevcut Şifre', currentPassword, setCurrentPassword],
            ['newPassword', 'Yeni Şifre', newPassword, setNewPassword],
            ['confirmPassword', 'Yeni Şifre (Tekrar)', confirmPassword, setConfirmPassword],
          ] as const).map(([key, label, val, setter]) => (
            <div key={key}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>{label}</label>
              <input
                type="password"
                value={val}
                onChange={(e) => setter(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword} style={{ padding: '7px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: 'fit-content' }}>
            {savingPassword ? 'Değiştiriliyor…' : 'Şifreyi Değiştir'}
          </button>
        </div>
      </div>

      {/* Memberships */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 16 }}>Aktif Üyelikler</div>
        {memberships.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Üyelik yok</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {memberships.map((m) => (
              <div key={m.tenantId} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.tenantName}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Rol: <span style={{ color: '#374151', fontWeight: 500 }}>{m.role.name}</span>
                </div>
                {m.malls.length > 0 && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    Mall: {m.malls.map((ml) => ml.name).join(', ')}
                  </div>
                )}
                {(m.capabilities ?? []).length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(m.capabilities ?? []).slice(0, 8).map((c) => (
                      <span key={c} style={{ fontSize: 10, padding: '2px 6px', background: '#f0fdf4', color: '#16a34a', borderRadius: 8, fontFamily: 'monospace' }}>{c}</span>
                    ))}
                    {(m.capabilities ?? []).length > 8 && <span style={{ fontSize: 10, color: '#9ca3af' }}>+{(m.capabilities ?? []).length - 8}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
