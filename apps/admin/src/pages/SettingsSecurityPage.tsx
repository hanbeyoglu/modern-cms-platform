import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { apiSettingsGet, apiSettingsUpdateSecurity, type SecuritySettings } from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

export function SettingsSecurityPage() {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();

  const [form, setForm] = useState<SecuritySettings>({
    sessionTimeoutMinutes: 60,
    allowPublicRegistration: false,
    maintenanceMode: false,
    passwordPolicy: 'default',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    apiSettingsGet(accessToken, activeTenantId)
      .then((d) => setForm(d.security))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, activeTenantId]);

  const handleSave = async () => {
    if (!accessToken || !activeTenantId) return;
    setSaving(true);
    try {
      const data = await apiSettingsUpdateSecurity(accessToken, activeTenantId, form);
      setForm(data.security);
      setSaved(true);
      toast.success('Güvenlik ayarları kaydedildi');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const canEdit = can('settings:update');

  return (
    <PageContainer>
      <PageHeader title="Güvenlik Ayarları" subtitle="Oturum, şifre politikası ve erişim kontrolü" />

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : (
        <div style={{ maxWidth: 540 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                Oturum Zaman Aşımı (dakika)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={form.sessionTimeoutMinutes}
                onChange={(e) => { setForm((p) => ({ ...p, sessionTimeoutMinutes: parseInt(e.target.value, 10) || 60 })); setSaved(false); }}
                disabled={!canEdit}
                style={{ width: 120, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: canEdit ? '#fff' : '#f9fafb' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                Şifre Politikası (placeholder)
              </label>
              <select
                value={form.passwordPolicy}
                onChange={(e) => { setForm((p) => ({ ...p, passwordPolicy: e.target.value })); setSaved(false); }}
                disabled={!canEdit}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: canEdit ? '#fff' : '#f9fafb' }}
              >
                <option value="default">Varsayılan (min 8 karakter)</option>
                <option value="medium">Orta (8+ karakter, büyük/küçük harf)</option>
                <option value="strong">Güçlü (12+ karakter, özel karakter)</option>
              </select>
            </div>

            {([
              ['allowPublicRegistration', 'Halka açık kayıt izni (placeholder)'],
              ['maintenanceMode', 'Bakım modu (placeholder)'],
            ] as const).map(([key, label]) => (
              <div key={key} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{label}</div>
                </div>
                <div
                  onClick={() => { if (!canEdit) return; setForm((p) => ({ ...p, [key]: !p[key] })); setSaved(false); }}
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: form[key] ? '#2563eb' : '#d1d5db',
                    position: 'relative', cursor: canEdit ? 'pointer' : 'default', transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3,
                    left: form[key] ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </div>
            ))}

            {canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                {saved && <span style={{ fontSize: 13, color: '#16a34a' }}>Kaydedildi</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
