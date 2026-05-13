import { FormEvent, useState } from 'react';
import { apiLogin } from '../lib/api';
import { useAuth } from '../auth/useAuth';

export function LoginPage() {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('superadmin@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        email: res.user.email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginTop: 0 }}>CMS Admin Girişi</h1>
      <p style={{ color: '#4b5563' }}>Sprint 1: yer tutucu giriş ekranı (API öncelikli).</p>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>E-posta</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Şifre</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
          />
        </label>
        {error ? <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}
