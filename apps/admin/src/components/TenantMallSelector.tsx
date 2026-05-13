import { useAuth } from '../auth/useAuth';

export function TenantMallSelector() {
  const { tenants, activeTenantId, malls, activeMallId, selectTenant, selectMall } = useAuth();

  if (tenants.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Tenant</span>
        <select
          value={activeTenantId ?? ''}
          onChange={(e) => selectTenant(e.target.value)}
          style={{ fontSize: 13, padding: '2px 6px' }}
        >
          {tenants.length > 1 && <option value="">— seç —</option>}
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {activeTenantId && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Mall</span>
          <select
            value={activeMallId ?? ''}
            onChange={(e) => selectMall(e.target.value || null)}
            style={{ fontSize: 13, padding: '2px 6px' }}
          >
            <option value="">— tümü —</option>
            {malls.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
