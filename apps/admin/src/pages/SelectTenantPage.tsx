import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import type { Tenant } from '../lib/api';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f9fafb',
  padding: 24,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const panelStyle: React.CSSProperties = {
  width: 'min(960px, 100%)',
  display: 'grid',
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 18,
  display: 'grid',
  gap: 12,
};

function isTenantDisabled(tenant: Tenant): boolean {
  return tenant.status.toUpperCase() === 'DISABLED';
}

function statusStyle(status: string): React.CSSProperties {
  const normalized = status.toUpperCase();
  const active = normalized === 'ACTIVE';

  return {
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 700,
    color: active ? '#166534' : '#7f1d1d',
    background: active ? '#dcfce7' : '#fee2e2',
  };
}

export function SelectTenantPage() {
  const { tenants, user, activeTenantId, selectTenant } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.isSuperAdmin && tenants.length === 1 && !isTenantDisabled(tenants[0])) {
      selectTenant(tenants[0].id);
      void navigate('/dashboard', { replace: true });
    }
  }, [navigate, selectTenant, tenants, user?.isSuperAdmin]);

  function capabilitySummary(tenantId: string): string {
    if (user?.isSuperAdmin) return 'Platform-wide access';
    const membership = user?.memberships?.find((item) => item.tenantId === tenantId);
    if (!membership) return 'No membership details';

    const capabilities = membership.capabilities ?? [];
    if (capabilities.length === 0) return membership.role.name;

    return `${membership.role.name} · ${capabilities.slice(0, 3).join(', ')}${
      capabilities.length > 3 ? ` +${capabilities.length - 3}` : ''
    }`;
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, color: '#111827' }}>Select tenant</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            Choose the tenant context before opening the admin workspace.
          </p>
        </div>

        {tenants.length === 0 ? (
          <div style={cardStyle}>
            <strong>No tenants available</strong>
            <span style={{ color: '#6b7280' }}>
              Your account does not currently have access to an enabled tenant.
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {tenants.map((tenant) => {
              const disabled = isTenantDisabled(tenant);

              return (
                <article key={tenant.id} style={cardStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 16,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 5 }}>
                      <strong style={{ fontSize: 16, color: '#111827' }}>{tenant.name}</strong>
                      <span style={{ color: '#6b7280', fontSize: 13 }}>{tenant.slug}</span>
                    </div>
                    <span style={statusStyle(tenant.status)}>{tenant.status}</span>
                  </div>

                  <div style={{ color: '#4b5563', fontSize: 13 }}>{capabilitySummary(tenant.id)}</div>

                  <button
                    type="button"
                    disabled={disabled || activeTenantId === tenant.id}
                    onClick={() => {
                      selectTenant(tenant.id);
                      void navigate('/select-location', { replace: true });
                    }}
                    style={{
                      justifySelf: 'start',
                      border: '1px solid #2563eb',
                      background: disabled || activeTenantId === tenant.id ? '#eff6ff' : '#2563eb',
                      color: disabled || activeTenantId === tenant.id ? '#1d4ed8' : '#fff',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontWeight: 700,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {activeTenantId === tenant.id ? 'Selected' : 'Select tenant'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
