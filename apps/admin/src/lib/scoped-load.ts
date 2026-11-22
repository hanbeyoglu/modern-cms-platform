import { useEffect, useRef, useState } from 'react';

export type LoadState<T> =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

/**
 * Loads data for a scope key (e.g. "summary:<tenant>:<mall>").
 * - `key === null` → no request at all (no permission / no context).
 * - When the key changes, data from the previous scope is never shown and
 *   late responses for an old key are ignored.
 */
export function useScopedLoad<T>(key: string | null, loader: () => Promise<T>) {
  const [entry, setEntry] = useState<{ key: string | null; state: LoadState<T> }>({
    key: null,
    state: { status: 'disabled' },
  });
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (key === null) {
      setEntry({ key: null, state: { status: 'disabled' } });
      return;
    }
    let cancelled = false;
    setEntry({ key, state: { status: 'loading' } });
    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setEntry({ key, state: { status: 'ready', data } });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setEntry({
            key,
            state: { status: 'error', message: err instanceof Error ? err.message : 'Veri alınamadı' },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const state: LoadState<T> =
    key === null ? { status: 'disabled' } : entry.key === key ? entry.state : { status: 'loading' };
  return { state, retry: () => setAttempt((n) => n + 1) };
}
