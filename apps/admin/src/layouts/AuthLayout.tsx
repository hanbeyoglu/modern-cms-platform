import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { accessToken, profileLoading } = useAuth();

  // Authenticated users should not see login page
  if (accessToken && !profileLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '36px 40px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
