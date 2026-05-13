import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { TenantMallSelector } from './components/TenantMallSelector';
import { LoginPage } from './pages/LoginPage';

function AuthenticatedShell() {
  const {
    user,
    email,
    tenants,
    activeTenantId,
    malls,
    activeMallId,
    profileLoading,
    clearSession,
  } = useAuth();

  if (profileLoading) {
    return (
      <div style={{ maxWidth: 960, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Profil yükleniyor…</p>
      </div>
    );
  }

  const displayName =
    user?.firstName || user?.lastName
      ? [user.firstName, user.lastName].filter(Boolean).join(' ')
      : (email ?? '—');

  const activeTenant = tenants.find((t) => t.id === activeTenantId);
  const activeMall = malls.find((m) => m.id === activeMallId);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <header
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>CMS Admin</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4b5563' }}>
            {displayName}
            {user?.isSuperAdmin && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                SUPER ADMIN
              </span>
            )}
          </p>
        </div>
        <button type="button" onClick={() => clearSession()} style={{ fontSize: 13 }}>
          Çıkış
        </button>
      </header>

      {/* Tenant / Mall Selector */}
      <section style={{ marginBottom: 24 }}>
        <TenantMallSelector />
      </section>

      {/* Context Panel */}
      <section
        style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          fontSize: 13,
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Aktif Bağlam</h2>
        <div style={{ display: 'grid', gap: 4 }}>
          <div>
            <strong>Tenant:</strong> {activeTenant ? `${activeTenant.name} (${activeTenant.id})` : '—'}
          </div>
          <div>
            <strong>Mall:</strong> {activeMall ? `${activeMall.name} (${activeMall.id})` : '—'}
          </div>
        </div>
      </section>

      {/* User Profile */}
      {user && (
        <section
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            fontSize: 13,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Kullanıcı</h2>
          <div style={{ display: 'grid', gap: 4 }}>
            <div><strong>ID:</strong> {user.id}</div>
            <div><strong>E-posta:</strong> {user.email}</div>
            <div><strong>Durum:</strong> {user.status}</div>
            <div>
              <strong>Super Admin:</strong> {user.isSuperAdmin ? 'Evet' : 'Hayır'}
            </div>
          </div>
        </section>
      )}

      {/* Tenants */}
      {tenants.length > 0 && (
        <section
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            fontSize: 13,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
            Tenantlar ({tenants.length})
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {tenants.map((t) => (
              <li
                key={t.id}
                style={{
                  padding: '6px 10px',
                  background: t.id === activeTenantId ? '#eff6ff' : '#fff',
                  border: `1px solid ${t.id === activeTenantId ? '#bfdbfe' : '#e5e7eb'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                onClick={() => (t.id !== activeTenantId ? undefined : undefined)}
              >
                <strong>{t.name}</strong>{' '}
                <span style={{ color: '#6b7280' }}>
                  {t.slug} · {t.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Malls */}
      {malls.length > 0 && (
        <section
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            fontSize: 13,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
            Malllar — {activeTenant?.name} ({malls.length})
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {malls.map((m) => (
              <li
                key={m.id}
                style={{
                  padding: '6px 10px',
                  background: m.id === activeMallId ? '#eff6ff' : '#fff',
                  border: `1px solid ${m.id === activeMallId ? '#bfdbfe' : '#e5e7eb'}`,
                  borderRadius: 6,
                }}
              >
                <strong>{m.name}</strong>{' '}
                <span style={{ color: '#6b7280' }}>
                  {m.slug} · {m.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Placeholder for future modules */}
      <section
        style={{
          marginTop: 24,
          padding: 16,
          border: '1px dashed #d1d5db',
          borderRadius: 8,
          color: '#6b7280',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        Sprint 3+ — CMS iş modülleri burada yer alacak
      </section>
    </div>
  );
}

function Shell() {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <LoginPage />;
  }

  return <AuthenticatedShell />;
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
