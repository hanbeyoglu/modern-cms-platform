import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { apiMe, apiTenants, apiMalls, onUnauthorized, type Mall, type Tenant } from '../lib/api';
import {
  AuthContext,
  initialAuthState,
  persistAdminContext,
  persistTokens,
  type AuthContextValue,
  type AuthState,
  type AuthUser,
} from './auth-context';
import { mallsFromMembership } from './mall-context';

type Action =
  | { type: 'SET_SESSION'; accessToken: string; refreshToken: string; email: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_PROFILE'; user: AuthUser; tenants: Tenant[] }
  | { type: 'SET_MALLS'; tenantId: string; malls: Mall[] }
  | { type: 'SET_MALLS_FAILED'; tenantId: string; error: string }
  | { type: 'CLEAR_TENANT_CONTEXT' }
  | { type: 'SELECT_TENANT'; tenantId: string; malls?: Mall[] }
  | { type: 'SELECT_MALL'; mallId: string | null }
  | { type: 'PROFILE_LOADING'; loading: boolean };

function isTenantSelectable(tenant: Tenant): boolean {
  return tenant.status.toUpperCase() !== 'DISABLED';
}

function resolveActiveMallId(
  malls: Mall[],
  currentMallId: string | null,
): string | null {
  if (malls.length === 0) return null;

  const validIds = new Set(malls.map((mall) => mall.id));
  if (currentMallId && validIds.has(currentMallId)) {
    return currentMallId;
  }

  if (malls.length === 1) {
    return malls[0].id;
  }

  return null;
}

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
        email: action.email,
        user: null,
        tenants: [],
        activeTenantId: null,
        malls: [],
        activeMallId: null,
        profileLoading: true,
        mallsLoading: false,
        mallsError: null,
      };
    case 'CLEAR_SESSION':
      return {
        accessToken: null,
        refreshToken: null,
        email: null,
        user: null,
        tenants: [],
        activeTenantId: null,
        malls: [],
        activeMallId: null,
        profileLoading: false,
        mallsLoading: false,
        mallsError: null,
      };
    case 'SET_PROFILE': {
      const selectableTenants = action.tenants.filter(isTenantSelectable);
      const existingTenant = selectableTenants.find((tenant) => tenant.id === state.activeTenantId);
      const nextTenantId =
        existingTenant?.id ??
        (!action.user.isSuperAdmin && selectableTenants.length === 1 ? selectableTenants[0].id : null);
      const tenantUnchanged = nextTenantId === state.activeTenantId;
      const membershipMalls =
        nextTenantId && !action.user.isSuperAdmin
          ? mallsFromMembership(action.user, nextTenantId)
          : null;
      const nextMalls =
        membershipMalls ??
        (tenantUnchanged ? state.malls : []);
      const preservedMallId = tenantUnchanged ? state.activeMallId : null;
      return {
        ...state,
        user: action.user,
        tenants: action.tenants,
        activeTenantId: nextTenantId,
        malls: nextMalls,
        activeMallId: resolveActiveMallId(nextMalls, preservedMallId),
        profileLoading: false,
        mallsLoading: Boolean(nextTenantId && action.user.isSuperAdmin && nextMalls.length === 0),
        mallsError: tenantUnchanged ? state.mallsError : null,
      };
    }
    case 'SET_MALLS': {
      if (action.tenantId !== state.activeTenantId) {
        return state;
      }
      return {
        ...state,
        malls: action.malls,
        activeMallId: resolveActiveMallId(action.malls, state.activeMallId),
        mallsLoading: false,
        mallsError: null,
      };
    }
    case 'SET_MALLS_FAILED': {
      if (action.tenantId !== state.activeTenantId) {
        return state;
      }
      return {
        ...state,
        malls: [],
        activeMallId: null,
        mallsLoading: false,
        mallsError: action.error,
      };
    }
    case 'CLEAR_TENANT_CONTEXT':
      return {
        ...state,
        activeTenantId: null,
        malls: [],
        activeMallId: null,
        mallsLoading: false,
        mallsError: null,
      };
    case 'SELECT_TENANT': {
      const malls = action.malls ?? [];
      return {
        ...state,
        activeTenantId: action.tenantId,
        malls,
        activeMallId: resolveActiveMallId(malls, state.activeMallId),
        mallsLoading: action.malls === undefined && action.tenantId.length > 0,
        mallsError: null,
      };
    }
    case 'SELECT_MALL':
      return { ...state, activeMallId: action.mallId };
    case 'PROFILE_LOADING':
      return { ...state, profileLoading: action.loading };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialAuthState);

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
    persistAdminContext({
      activeTenantId: state.activeTenantId,
      activeMallId: state.activeMallId,
    });
  }, [state.activeTenantId, state.activeMallId]);

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
