import { useState } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { TenantMallSelector } from './components/TenantMallSelector';
import { LoginPage } from './pages/LoginPage';
import { MediaPage } from './pages/MediaPage';

type Page = 'dashboard' | 'media';

const NAV_ITEMS: Array<{ id: Page; label: string }> = [
  { id: 'dashboard', label: 'Gösterge Paneli' },
  { id: 'media', label: 'Medya Kütüphanesi' },
];

function Nav({ current, onNavigate }: { current: Page; onNavigate: (p: Page) => void }) {
  return (
    <nav style={{ display: 'flex', gap: 4 }}>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            border: '1px solid',
            borderColor: current === item.id ? '#2563eb' : '#d1d5db',
            background: current === item.id ? '#eff6ff' : '#fff',
            color: current === item.id ? '#1d4ed8' : '#374151',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function AuthenticatedShell() {
  const { user, email, tenants, activeTenantId, malls, activeMallId, profileLoading, clearSession } =
    useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

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
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <header
        style={{
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>CMS Admin</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: '#6b7280' }}>
              {displayName}
              {user?.isSuperAdmin && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    background: '#fef3c7',
                    color: '#92400e',
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}
                >
                  SUPER ADMIN
                </span>
              )}
            </span>
          </div>
          <Nav current={currentPage} onNavigate={setCurrentPage} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TenantMallSelector />
          <button type="button" onClick={() => clearSession()} style={{ fontSize: 12 }}>
            Çıkış
          </button>
        </div>
      </header>

      {/* Active context bar */}
      {(activeTenant || activeMall) && (
        <div
          style={{
            fontSize: 12,
            color: '#4b5563',
            marginBottom: 16,
            padding: '6px 10px',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            display: 'flex',
            gap: 16,
          }}
        >
          {activeTenant && (
            <span>
              <strong>Tenant:</strong> {activeTenant.name}
            </span>
          )}
          {activeMall && (
            <span>
              <strong>Mall:</strong> {activeMall.name}
            </span>
          )}
        </div>
      )}

      {/* Page content */}
      <main>
        {currentPage === 'dashboard' && <DashboardView />}
        {currentPage === 'media' && <MediaPage />}
      </main>
    </div>
  );
}

function DashboardView() {
  const { user, tenants, malls, activeTenantId, activeMallId } = useAuth();
  const activeTenant = tenants.find((t) => t.id === activeTenantId);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* User card */}
      {user && (
        <section
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            fontSize: 13,
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>Kullanıcı</h2>
          <div style={{ display: 'grid', gap: 3 }}>
            <div><strong>ID:</strong> {user.id}</div>
            <div><strong>E-posta:</strong> {user.email}</div>
            <div><strong>Durum:</strong> {user.status}</div>
            <div><strong>Super Admin:</strong> {user.isSuperAdmin ? 'Evet' : 'Hayır'}</div>
          </div>
        </section>
      )}

      {/* Tenant list */}
      {tenants.length > 0 && (
        <section
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            fontSize: 13,
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>
            Tenantlar ({tenants.length})
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
            {tenants.map((t) => (
              <li
                key={t.id}
                style={{
                  padding: '5px 10px',
                  background: t.id === activeTenantId ? '#eff6ff' : '#fff',
                  border: `1px solid ${t.id === activeTenantId ? '#bfdbfe' : '#e5e7eb'}`,
                  borderRadius: 6,
                }}
              >
                <strong>{t.name}</strong>{' '}
                <span style={{ color: '#6b7280' }}>{t.slug} · {t.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mall list */}
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
          <h2 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>
            Malllar — {activeTenant?.name} ({malls.length})
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
            {malls.map((m) => (
              <li
                key={m.id}
                style={{
                  padding: '5px 10px',
                  background: m.id === activeMallId ? '#eff6ff' : '#fff',
                  border: `1px solid ${m.id === activeMallId ? '#bfdbfe' : '#e5e7eb'}`,
                  borderRadius: 6,
                }}
              >
                <strong>{m.name}</strong>{' '}
                <span style={{ color: '#6b7280' }}>{m.slug} · {m.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        style={{
          padding: 16,
          border: '1px dashed #d1d5db',
          borderRadius: 8,
          color: '#6b7280',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        Sprint 4+ — CMS iş modülleri burada yer alacak
      </section>
    </div>
  );
}

function Shell() {
  const { accessToken } = useAuth();
  if (!accessToken) return <LoginPage />;
  return <AuthenticatedShell />;
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
