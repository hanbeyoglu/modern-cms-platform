import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  apiCapabilitiesList,
  apiTenantCapabilitiesList,
  apiTenantCapabilitiesUpdate,
  type TenantCapabilityRow,
  type CapabilityCategory,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

const CATEGORY_LABELS: Record<CapabilityCategory, string> = {
  CORE: 'Çekirdek',
  CONTENT: 'İçerik',
  OPERATIONS: 'Operasyon',
  ANALYTICS: 'Analitik',
  LOCALIZATION: 'Lokalizasyon',
  PUBLIC_DELIVERY: 'Public API',
  SEARCH: 'Arama',
  CDP: 'CDP (Gelecek)',
  AI: 'Yapay Zeka (Gelecek)',
  INTEGRATION: 'Entegrasyonlar (Gelecek)',
};

export function CapabilitiesPage() {
  const { accessToken, tenants, activeTenantId, user } = useAuth();

  const [selectedTenantId, setSelectedTenantId] = useState<string>(activeTenantId ?? '');
  const [rows, setRows] = useState<TenantCapabilityRow[]>([]);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // For super admins who haven't selected a tenant yet, load all capabilities
  useEffect(() => {
    if (!accessToken || !user?.isSuperAdmin) return;
    if (!selectedTenantId) {
      apiCapabilitiesList(accessToken)
        .then((data) =>
          setRows(data.capabilities.map((c) => ({ ...c, enabled: false, enabledAt: null, disabledAt: null })))
        )
        .catch(() => {});
    }
  }, [accessToken, user, selectedTenantId]);

  const loadTenantCaps = useCallback(
    (tenantId: string) => {
      if (!accessToken || !tenantId) return;
      setLoading(true);
      setError(null);
      apiTenantCapabilitiesList(accessToken, tenantId)
        .then((data) => {
          setRows(data.capabilities);
          const init: Record<string, boolean> = {};
          for (const r of data.capabilities) init[r.code] = r.enabled;
          setPending(init);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [accessToken],
  );

  useEffect(() => {
    if (selectedTenantId) loadTenantCaps(selectedTenantId);
  }, [selectedTenantId, loadTenantCaps]);

  const handleToggle = (code: string, value: boolean) => {
    setPending((prev) => ({ ...prev, [code]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!accessToken || !selectedTenantId) return;
    setSaving(true);
    setError(null);
    try {
      const updates = Object.entries(pending).map(([code, enabled]) => ({ code, enabled }));
      const data = await apiTenantCapabilitiesUpdate(accessToken, selectedTenantId, updates);
      setRows(data.capabilities);
      const updated: Record<string, boolean> = {};
      for (const r of data.capabilities) updated[r.code] = r.enabled;
      setPending(updated);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const grouped = rows.reduce<Record<string, TenantCapabilityRow[]>>((acc, row) => {
    const key = row.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const isDirty = rows.some((r) => pending[r.code] !== r.enabled);

  return (
    <PageContainer>
      <PageHeader
        title="Yetenekler"
        subtitle="Tenant bazlı özellik paketlerini yönetin"
      />

      {/* Tenant selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          Tenant
        </label>
        <select
          value={selectedTenantId}
          onChange={(e) => {
            setSelectedTenantId(e.target.value);
            setSaved(false);
          }}
          style={{
            padding: '7px 12px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            fontSize: 13,
            minWidth: 280,
          }}
        >
          <option value="">— Tenant seçin —</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>}

      {!loading && selectedTenantId && rows.length > 0 && (
        <>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}>
                {CATEGORY_LABELS[category as CapabilityCategory] ?? category}
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {items.map((item, idx) => (
                  <div
                    key={item.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
                      background: '#fff',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.name}</div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.description}</div>
                      )}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>{item.code}</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                      <span style={{ fontSize: 12, color: (pending[item.code] ?? item.enabled) ? '#16a34a' : '#9ca3af' }}>
                        {(pending[item.code] ?? item.enabled) ? 'Aktif' : 'Pasif'}
                      </span>
                      <div
                        onClick={() => handleToggle(item.code, !(pending[item.code] ?? item.enabled))}
                        style={{
                          width: 40,
                          height: 22,
                          borderRadius: 11,
                          background: (pending[item.code] ?? item.enabled) ? '#2563eb' : '#d1d5db',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: 3,
                          left: (pending[item.code] ?? item.enabled) ? 21 : 3,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.15s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              style={{
                padding: '8px 20px',
                background: isDirty ? '#2563eb' : '#d1d5db',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: isDirty ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {saved && !isDirty && (
              <span style={{ fontSize: 13, color: '#16a34a' }}>Kaydedildi</span>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
