import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { useAuth } from '../auth/useAuth';

export function DashboardLayout() {
  const { profileLoading } = useAuth();

  if (profileLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#6b7280',
          fontSize: 14,
        }}
      >
        Profil yükleniyor…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        color: '#111827',
      }}
    >
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#fff',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
