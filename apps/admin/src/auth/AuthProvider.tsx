import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, type ReactNode } from 'react';
import { request, setApiContext, setSessionRefresher } from '../lib/api/client';
import { apiMe, apiTenants, apiMalls, onUnauthorized, type Mall, type Tenant } from '../lib/api';
import {
  AuthContext,
  initialAuthState,
  persistAdminContext,
  persistTokens,
  type AuthContextValue,
  type AuthUser,
} from './auth-context';
import { mallsFromMembership } from './mall-context';
import { authReducer } from './auth-reducer';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, initialAuthState);

  useLayoutEffect(() => {
    setApiContext(state.activeTenantId, state.activeMallId);
    return () => setApiContext(null, null);
  }, [state.activeTenantId, state.activeMallId]);

  useLayoutEffect(() => {
    let cancelled = false;
    setSessionRefresher(state.refreshToken ? async () => {
      const tokens = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST', body: JSON.stringify({ refreshToken: state.refreshToken }),
      });
      if (cancelled) throw new Error('Oturum değişti');
      persistTokens({ ...tokens, email: state.email });
      dispatch({ type: 'REFRESH_SESSION', ...tokens });
      return tokens.accessToken;
    } : undefined);
    return () => { cancelled = true; setSessionRefresher(undefined); };
  }, [state.refreshToken, state.email]);

  // Auto-load profile whenever access token changes
  useEffect(() => {
    if (!state.accessToken) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        const [profile, tenantsData] = await Promise.all([
          apiMe(state.accessToken!),
          apiTenants(state.accessToken!),
        ]);
        if (!cancelled) {
          dispatch({ type: 'SET_PROFILE', user: profile, tenants: tenantsData.tenants });
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: 'CLEAR_SESSION' });
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [state.accessToken]);

  // Super admins enrich context via /malls/my; others hydrate from /auth/me memberships only.
  useEffect(() => {
    if (!state.accessToken || !state.activeTenantId || !state.user?.isSuperAdmin) return;

    const tenantId = state.activeTenantId;
    let cancelled = false;

    async function loadMalls() {
      try {
        const data = await apiMalls(state.accessToken!, tenantId);
        if (!cancelled) {
          dispatch({ type: 'SET_MALLS', tenantId, malls: data.malls });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'AVM listesi yüklenemedi';
          dispatch({ type: 'SET_MALLS_FAILED', tenantId, error: message });
        }
      }
    }

    void loadMalls();
    return () => {
      cancelled = true;
    };
  }, [state.accessToken, state.activeTenantId, state.user?.isSuperAdmin]);

  // Keep single-mall tenants pinned to their only location.
  useEffect(() => {
    if (state.mallsLoading || state.malls.length !== 1 || state.activeMallId) return;
    dispatch({ type: 'SELECT_MALL', mallId: state.malls[0].id });
  }, [state.malls, state.mallsLoading, state.activeMallId]);

  useEffect(() => {
    // While a stored scope is still being verified, keep storage as it is.
    if (state.pendingTenantId || state.pendingMallId) return;
    persistAdminContext({
      activeTenantId: state.activeTenantId,
      activeMallId: state.activeMallId,
    });
  }, [state.activeTenantId, state.activeMallId, state.pendingTenantId, state.pendingMallId]);

  // Auto-logout on 401 from any API call
  useEffect(() => {
    return onUnauthorized(() => {
      persistTokens({ accessToken: null, refreshToken: null, email: null });
      dispatch({ type: 'CLEAR_SESSION' });
    });
  }, []);

  const setSession = useCallback(
    (tokens: { accessToken: string; refreshToken: string; email: string }) => {
      persistTokens(tokens);
      dispatch({ type: 'SET_SESSION', ...tokens });
    },
    [],
  );

  const clearSession = useCallback(() => {
    persistTokens({ accessToken: null, refreshToken: null, email: null });
    persistAdminContext({ activeTenantId: null, activeMallId: null });
    dispatch({ type: 'CLEAR_SESSION' });
  }, []);

  const setProfile = useCallback((user: AuthUser, tenants: Tenant[]) => {
    dispatch({ type: 'SET_PROFILE', user, tenants });
  }, []);

  const setMalls = useCallback(
    (malls: Mall[]) => {
      if (!state.activeTenantId) return;
      dispatch({ type: 'SET_MALLS', tenantId: state.activeTenantId, malls });
    },
    [state.activeTenantId],
  );

  const selectTenant = useCallback(
    (tenantId: string) => {
      if (!tenantId) {
        dispatch({ type: 'CLEAR_TENANT_CONTEXT' });
        return;
      }
      if (state.user && !state.user.isSuperAdmin) {
        dispatch({
          type: 'SELECT_TENANT',
          tenantId,
          malls: mallsFromMembership(state.user, tenantId),
        });
      } else {
        dispatch({ type: 'SELECT_TENANT', tenantId });
      }
    },
    [state.user],
  );

  const selectMall = useCallback((mallId: string | null) => {
    dispatch({ type: 'SELECT_MALL', mallId });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, setSession, clearSession, setProfile, setMalls, selectTenant, selectMall }),
    [state, setSession, clearSession, setProfile, setMalls, selectTenant, selectMall],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
