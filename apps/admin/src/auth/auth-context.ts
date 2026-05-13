import { createContext } from 'react';
import type { Mall, MeResponse, Tenant } from '../lib/api';

export type AuthUser = Pick<
  MeResponse,
  'id' | 'email' | 'firstName' | 'lastName' | 'isSuperAdmin' | 'status' | 'memberships'
>;

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  user: AuthUser | null;
  tenants: Tenant[];
  activeTenantId: string | null;
  malls: Mall[];
  activeMallId: string | null;
  profileLoading: boolean;
};

export type AuthContextValue = AuthState & {
  setSession: (tokens: { accessToken: string; refreshToken: string; email: string }) => void;
  clearSession: () => void;
  setProfile: (user: AuthUser, tenants: Tenant[]) => void;
  setMalls: (malls: Mall[]) => void;
  selectTenant: (tenantId: string) => void;
  selectMall: (mallId: string | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AUTH_STORAGE_KEY = 'modern-cms.admin.auth';

type PersistedTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
};

export function loadTokensFromStorage(): PersistedTokens {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null, email: null };
    const parsed = JSON.parse(raw) as PersistedTokens;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      email: parsed.email ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, email: null };
  }
}

export function persistTokens(tokens: PersistedTokens): void {
  if (!tokens.accessToken && !tokens.refreshToken) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
}

export function initialAuthState(): AuthState {
  const tokens =
    typeof window === 'undefined'
      ? { accessToken: null, refreshToken: null, email: null }
      : loadTokensFromStorage();

  return {
    ...tokens,
    user: null,
    tenants: [],
    activeTenantId: null,
    malls: [],
    activeMallId: null,
    profileLoading: tokens.accessToken !== null,
  };
}
