import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { apiSettingsGet, apiSettingsUpdateGeneral, type GeneralSettings } from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

const TIMEZONES = [
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Tokyo',
];

export function SettingsGeneralPage() {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();

  const [form, setForm] = useState<GeneralSettings>({
    displayName: '',
    timezone: 'Europe/Istanbul',
    defaultLocale: 'tr',
    supportEmail: '',
    logoUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    apiSettingsGet(accessToken, activeTenantId)
      .then((d) => setForm(d.general))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, activeTenantId]);

  const handleSave = async () => {
    if (!accessToken || !activeTenantId) return;
    setSaving(true);
    try {
      const data = await apiSettingsUpdateGeneral(accessToken, activeTenantId, form);
      setForm(data.general);
      setSaved(true);
      toast.success('Ayarlar kaydedildi');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const canEdit = can('settings:update');

  const fields: Array<{ key: keyof GeneralSettings; label: string; type?: string }> = [
    { key: 'displayName', label: 'Görünen Ad' },
    { key: 'supportEmail', label: 'Destek E-postası', type: 'email' },
    { key: 'logoUrl', label: 'Logo URL' },
    { key: 'defaultLocale', label: 'Varsayılan Dil' },
  ];

  return (
    <PageContainer>
      <PageHeader title="Genel Ayarlar" subtitle="Tenant görünüm ve iletişim ayarları" />

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : (
        <div style={{ maxWidth: 540 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
            {fields.map(({ key, label, type }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>{label}</label>
                <input
                  type={type ?? 'text'}
                  value={form[key] as string}
                  onChange={(e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setSaved(false); }}
                  disabled={!canEdit}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: canEdit ? '#fff' : '#f9fafb', color: canEdit ? '#111827' : '#6b7280' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>Saat Dilimi</label>
              <select
                value={form.timezone}
                onChange={(e) => { setForm((p) => ({ ...p, timezone: e.target.value })); setSaved(false); }}
                disabled={!canEdit}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: canEdit ? '#fff' : '#f9fafb', color: canEdit ? '#111827' : '#6b7280' }}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

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
