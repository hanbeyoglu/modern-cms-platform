import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function ProtectedRoute() {
  const { accessToken, profileLoading, activeTenantId, activeMallId, malls, mallsLoading } = useAuth();
  const location = useLocation();

  if (profileLoading) {
    return null;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  const isTenantRoute = location.pathname === '/select-tenant';
  const isLocationRoute = location.pathname === '/select-location';

  if (!activeTenantId && !isTenantRoute) {
    return <Navigate to="/select-tenant" replace />;
  }

  if (isLocationRoute && !activeTenantId) {
    return <Navigate to="/select-tenant" replace />;
  }

  if (activeTenantId && mallsLoading && !isTenantRoute && !isLocationRoute) {
    return null;
  }

  if (
    activeTenantId &&
    !activeMallId &&
    !mallsLoading &&
    malls.length > 1 &&
    !isTenantRoute &&
    !isLocationRoute
  ) {
    return <Navigate to="/select-location" replace />;
  }

  return <Outlet />;
}
