import { PlaceholderPanel } from '@modern-cms/ui';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { LoginPage } from './pages/LoginPage';

function Shell() {
  const { accessToken, email, clearSession } = useAuth();

  if (!accessToken) {
    return <LoginPage />;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>CMS Admin</h1>
          <p style={{ margin: '8px 0 0', color: '#4b5563' }}>Oturum: {email}</p>
        </div>
        <button type="button" onClick={() => clearSession()}>
          Çıkış
        </button>
      </header>
      <main style={{ display: 'grid', gap: 16 }}>
        <PlaceholderPanel title="Gösterge paneli (Sprint 1)" />
        <PlaceholderPanel title="Sonraki sprintlerde içerik modülleri" />
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
