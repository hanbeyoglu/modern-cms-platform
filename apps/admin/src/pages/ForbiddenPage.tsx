import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.15, lineHeight: 1 }}>◎</div>
        <div
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: '#ef4444',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: '3px 10px',
            marginBottom: 16,
          }}
        >
          403 — Erişim Reddedildi
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: 22, color: '#111827', fontWeight: 700 }}>
          Bu sayfaya erişim yetkiniz yok
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          {user?.isSuperAdmin
            ? 'Bu sayfaya erişmek için gerekli izinler eksik.'
            : 'Bu sayfayı görmek için gerekli rol veya yetki mevcut değil. Yöneticinizle iletişime geçin.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '8px 18px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              background: '#fff',
              color: '#374151',
            }}
          >
            ← Geri Dön
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Panele Git
          </button>
        </div>
      </div>
    </div>
  );
}
