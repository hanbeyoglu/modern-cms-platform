const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const UNAUTHORIZED_EVENT = 'cms:unauthorized';

let activeContext: { tenantId?: string; mallId?: string } = {};
let refreshSession: (() => Promise<string>) | undefined;
let refreshing: Promise<string> | undefined;
let replacement: { previous: string; current: string } | undefined;

export function setSessionRefresher(refresher: (() => Promise<string>) | undefined): void {
  refreshSession = refresher;
  if (!refresher) replacement = undefined;
}

export function setApiContext(tenantId: string | null, mallId: string | null): void {
  activeContext = { tenantId: tenantId ?? undefined, mallId: mallId ?? undefined };
}

export function onUnauthorized(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

export type RequestOptions = RequestInit & {
  token?: string;
  tenantId?: string;
  mallId?: string;
};

export async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {};

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  const tenantId = options.tenantId ?? (options.token ? activeContext.tenantId : undefined);
  const mallId = options.mallId ?? (
    options.token && tenantId === activeContext.tenantId ? activeContext.mallId : undefined
  );
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (mallId) headers['x-mall-id'] = mallId;

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && options.token && refreshSession) {
    try {
      const originalToken = options.token;
      if (!refreshing && replacement?.previous !== originalToken) {
        refreshing = refreshSession().finally(() => { refreshing = undefined; });
      }
      const nextToken = replacement?.previous === originalToken
        ? replacement.current
        : await refreshing!;
      replacement = { previous: originalToken, current: nextToken };
      headers.Authorization = `Bearer ${nextToken}`;
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    } catch {
      // A rejected renewal is handled by the normal unauthorized path below.
    }
  }

  if (res.status === 401) {
    if (options.token) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
    }
  }

  if (!res.ok) {
    let message = `İstek başarısız (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string }; message?: string };
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
