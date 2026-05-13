import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  AuthContext,
  loadAuthFromStorage,
  persistAuthState,
  type AuthContextValue,
  type AuthState,
} from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    typeof window === 'undefined'
      ? { accessToken: null, refreshToken: null, email: null }
      : loadAuthFromStorage(),
  );

  const persist = useCallback((next: AuthState) => {
    setState(next);
    if (typeof window === 'undefined') return;
    persistAuthState(next);
  }, []);

  const setSession = useCallback(
    (tokens: { accessToken: string; refreshToken: string; email: string }) => {
      persist({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        email: tokens.email,
      });
    },
    [persist],
  );

  const clearSession = useCallback(() => {
    persist({ accessToken: null, refreshToken: null, email: null });
  }, [persist]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setSession,
      clearSession,
    }),
    [state, setSession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
