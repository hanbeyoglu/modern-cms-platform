import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { isMallScopedPath } from '../navigation/mall-scoped';

export function ProtectedRoute() {
  const {
    accessToken,
    profileLoading,
    activeTenantId,
    activeMallId,
    malls,
    mallsLoading,
    selectMall,
  } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (mallsLoading || !activeTenantId || activeMallId || malls.length !== 1) return;
    if (!isMallScopedPath(location.pathname)) return;
    selectMall(malls[0].id);
  }, [
    activeMallId,
    activeTenantId,
    location.pathname,
    malls,
    mallsLoading,
    selectMall,
  ]);

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

  if (
    activeTenantId &&
    !activeMallId &&
    !mallsLoading &&
    malls.length === 1 &&
    isMallScopedPath(location.pathname) &&
    !isTenantRoute &&
    !isLocationRoute
  ) {
    return null;
  }

  return <Outlet />;
}
