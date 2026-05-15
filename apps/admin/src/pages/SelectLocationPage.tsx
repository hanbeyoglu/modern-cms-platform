import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

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
  width: 'min(860px, 100%)',
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

function statusStyle(status: string): React.CSSProperties {
  const active = status.toUpperCase() === 'ACTIVE';

  return {
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 700,
    color: active ? '#166534' : '#7f1d1d',
    background: active ? '#dcfce7' : '#fee2e2',
  };
}

export function SelectLocationPage() {
  const { activeTenantId, tenants, malls, mallsLoading, selectMall } = useAuth();
  const navigate = useNavigate();
  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId);

  useEffect(() => {
    if (mallsLoading) return;

    if (malls.length === 1) {
      selectMall(malls[0].id);
      void navigate('/dashboard', { replace: true });
      return;
    }

    if (malls.length === 0) {
      void navigate('/dashboard', { replace: true });
    }
  }, [malls, mallsLoading, navigate, selectMall]);

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, color: '#111827' }}>Select location</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            {activeTenant
              ? `${activeTenant.name} has multiple locations. Choose where you want to work.`
              : 'Choose the location context before opening the admin workspace.'}
          </p>
        </div>

        {mallsLoading ? (
          <div style={cardStyle}>Locations loading…</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {malls.map((mall) => (
              <article key={mall.id} style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 5 }}>
                    <strong style={{ fontSize: 16, color: '#111827' }}>{mall.name}</strong>
                    <span style={{ color: '#6b7280', fontSize: 13 }}>{mall.slug}</span>
                  </div>
                  <span style={statusStyle(mall.status)}>{mall.status}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    selectMall(mall.id);
                    void navigate('/dashboard', { replace: true });
                  }}
                  style={{
                    justifySelf: 'start',
                    border: '1px solid #2563eb',
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Select location
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
