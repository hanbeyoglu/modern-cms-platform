import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiLogin } from '../lib/api';
import { useAuth } from '../auth/useAuth';

export function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('superadmin@example.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        email: res.user.email,
      });
      void navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
          CMS Admin
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
          Yönetici hesabınızla giriş yapın
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>E-posta</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={inputStyle}
            placeholder="ornek@sirket.com"
          />
        </label>

        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Şifre</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
            style={inputStyle}
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? '#93c5fd' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '9px 0',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 4,
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </>
  );
}
