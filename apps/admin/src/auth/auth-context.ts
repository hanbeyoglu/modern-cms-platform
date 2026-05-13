import { createContext } from 'react';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
};

export type AuthContextValue = AuthState & {
  setSession: (tokens: { accessToken: string; refreshToken: string; email: string }) => void;
  clearSession: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AUTH_STORAGE_KEY = 'modern-cms.admin.auth';

export function loadAuthFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { accessToken: null, refreshToken: null, email: null };
    }
    const parsed = JSON.parse(raw) as AuthState;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      email: parsed.email ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, email: null };
  }
}

export function persistAuthState(next: AuthState): void {
  if (!next.accessToken && !next.refreshToken) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
}
