import { useAuth } from '../auth/useAuth';

export function TenantMallSelector() {
  const { tenants, activeTenantId, malls, activeMallId, mallsLoading, selectTenant, selectMall } =
    useAuth();
  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId);
  const activeMall = malls.find((mall) => mall.id === activeMallId);
  const singleMall = malls.length === 1;

  if (tenants.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
      <div style={{ display: 'grid', gap: 2, minWidth: 130 }}>
        <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>
          Context
        </span>
        <span
          style={{
            fontSize: 13,
            color: '#111827',
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeTenant ? `${activeTenant.name}${activeMall ? ` / ${activeMall.name}` : ''}` : 'No tenant'}
        </span>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Tenant</span>
        <select
          value={activeTenantId ?? ''}
          onChange={(e) => selectTenant(e.target.value)}
          style={{ fontSize: 13, padding: '2px 6px' }}
        >
          {tenants.length > 1 && <option value="">— seç —</option>}
          {tenants.map((t) => (
            <option key={t.id} value={t.id} disabled={t.status.toUpperCase() === 'DISABLED'}>
              {t.name} ({t.slug})
            </option>
          ))}
        </select>
      </label>

      {activeTenantId && mallsLoading && (
        <span style={{ fontSize: 12, color: '#6b7280' }}>AVM bilgileri yükleniyor…</span>
      )}

      {activeTenantId && !mallsLoading && malls.length === 0 && (
        <span style={{ fontSize: 12, color: '#b45309' }}>
          Bu tenant için tanımlı AVM/lokasyon bulunamadı.
        </span>
      )}

      {activeTenantId && !mallsLoading && malls.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Mall</span>
          {singleMall ? (
            <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>
              {malls[0]!.name}
            </span>
          ) : (
            <select
              value={activeMallId ?? ''}
              onChange={(e) => selectMall(e.target.value || null)}
              style={{ fontSize: 13, padding: '2px 6px' }}
            >
              <option value="">— seç —</option>
              {malls.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </label>
      )}
    </div>
  );
}
