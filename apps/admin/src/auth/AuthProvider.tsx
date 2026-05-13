import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { apiMe, apiTenants, apiMalls, onUnauthorized, type Mall, type Tenant } from '../lib/api';
import {
  AuthContext,
  initialAuthState,
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
  | { type: 'SELECT_TENANT'; tenantId: string }
  | { type: 'SELECT_MALL'; mallId: string | null }
  | { type: 'PROFILE_LOADING'; loading: boolean };

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
      };
    case 'SET_PROFILE':
      return {
        ...state,
        user: action.user,
        tenants: action.tenants,
        activeTenantId: action.tenants.length === 1 ? action.tenants[0].id : state.activeTenantId,
        profileLoading: false,
      };
    case 'SET_MALLS':
      return { ...state, malls: action.malls, activeMallId: null };
    case 'SELECT_TENANT':
      return { ...state, activeTenantId: action.tenantId, malls: [], activeMallId: null };
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTenantId]);

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
    dispatch({ type: 'CLEAR_SESSION' });
  }, []);

  const setProfile = useCallback((user: AuthUser, tenants: Tenant[]) => {
    dispatch({ type: 'SET_PROFILE', user, tenants });
  }, []);

  const setMalls = useCallback((malls: Mall[]) => {
    dispatch({ type: 'SET_MALLS', malls });
  }, []);

  const selectTenant = useCallback((tenantId: string) => {
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
