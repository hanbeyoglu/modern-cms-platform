import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function ProtectedRoute() {
  const { accessToken, profileLoading } = useAuth();

  if (profileLoading) {
    return null;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
