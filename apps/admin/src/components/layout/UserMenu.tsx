import { useAuth } from '../../auth/useAuth';
import { useActiveMembership } from '../../hooks/useActiveMembership';

export function UserMenu() {
  const { user, email, clearSession } = useAuth();
  const membership = useActiveMembership();

  const displayName =
    user?.firstName || user?.lastName
      ? [user.firstName, user.lastName].filter(Boolean).join(' ')
      : (email ?? '—');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{displayName}</div>
        {!user?.isSuperAdmin && membership?.role.name && (
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{membership.role.name}</div>
        )}
        {user?.isSuperAdmin && (
          <span
            style={{
              fontSize: 10,
              background: '#fef3c7',
              color: '#92400e',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            SUPER ADMIN
          </span>
        )}
      </div>

      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: '#374151',
        }}
      >
        {displayName.charAt(0).toUpperCase()}
      </div>

      <button
        type="button"
        onClick={() => clearSession()}
        style={{
          fontSize: 12,
          padding: '4px 10px',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: '#fff',
          color: '#374151',
          cursor: 'pointer',
        }}
      >
        Çıkış
      </button>
    </div>
  );
}
