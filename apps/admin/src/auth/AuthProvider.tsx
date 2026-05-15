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

type Action =
  | { type: 'SET_SESSION'; accessToken: string; refreshToken: string; email: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_PROFILE'; user: AuthUser; tenants: Tenant[] }
  | { type: 'SET_MALLS'; malls: Mall[] }
  | { type: 'CLEAR_TENANT_CONTEXT' }
  | { type: 'SELECT_TENANT'; tenantId: string }
  | { type: 'SELECT_MALL'; mallId: string | null }
  | { type: 'PROFILE_LOADING'; loading: boolean };

function isTenantSelectable(tenant: Tenant): boolean {
  return tenant.status.toUpperCase() !== 'DISABLED';
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
      };
    case 'SET_PROFILE': {
      const selectableTenants = action.tenants.filter(isTenantSelectable);
      const existingTenant = selectableTenants.find((tenant) => tenant.id === state.activeTenantId);
      const nextTenantId =
        existingTenant?.id ??
        (!action.user.isSuperAdmin && selectableTenants.length === 1 ? selectableTenants[0].id : null);
      return {
        ...state,
        user: action.user,
        tenants: action.tenants,
        activeTenantId: nextTenantId,
        activeMallId: nextTenantId === state.activeTenantId ? state.activeMallId : null,
        malls: nextTenantId === state.activeTenantId ? state.malls : [],
        profileLoading: false,
        mallsLoading: nextTenantId === state.activeTenantId ? state.mallsLoading : !!nextTenantId,
      };
    }
    case 'SET_MALLS': {
      const activeMallBelongsToTenant = action.malls.some(
        (mall) => mall.id === state.activeMallId && mall.tenantId === state.activeTenantId,
      );
      const nextMallId =
        activeMallBelongsToTenant || action.malls.length !== 1 ? state.activeMallId : action.malls[0].id;
      return {
        ...state,
        malls: action.malls,
        activeMallId: activeMallBelongsToTenant || action.malls.length === 1 ? nextMallId : null,
        mallsLoading: false,
      };
    }
    case 'CLEAR_TENANT_CONTEXT':
      return { ...state, activeTenantId: null, malls: [], activeMallId: null, mallsLoading: false };
    case 'SELECT_TENANT':
      return {
        ...state,
        activeTenantId: action.tenantId,
        malls: [],
        activeMallId: null,
        mallsLoading: action.tenantId.length > 0,
      };
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

  // Auto-load malls whenever active tenant changes
  useEffect(() => {
    if (!state.accessToken || !state.activeTenantId) return;
    let cancelled = false;

    async function loadMalls() {
      try {
        const data = await apiMalls(state.accessToken!, state.activeTenantId!);
        if (!cancelled) dispatch({ type: 'SET_MALLS', malls: data.malls });
      } catch {
        if (!cancelled) dispatch({ type: 'SET_MALLS', malls: [] });
      }
    }

    void loadMalls();
    return () => {
      cancelled = true;
    };
  }, [state.accessToken, state.activeTenantId]);

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

  const setMalls = useCallback((malls: Mall[]) => {
    dispatch({ type: 'SET_MALLS', malls });
  }, []);

  const selectTenant = useCallback((tenantId: string) => {
    if (!tenantId) {
      dispatch({ type: 'CLEAR_TENANT_CONTEXT' });
      return;
    }
    dispatch({ type: 'SELECT_TENANT', tenantId });
  }, []);

  const selectMall = useCallback((mallId: string | null) => {
    dispatch({ type: 'SELECT_MALL', mallId });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, setSession, clearSession, setProfile, setMalls, selectTenant, selectMall }),
    [state, setSession, clearSession, setProfile, setMalls, selectTenant, selectMall],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
