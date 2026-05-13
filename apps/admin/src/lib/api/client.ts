const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const UNAUTHORIZED_EVENT = 'cms:unauthorized';

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
  if (options.tenantId) headers['x-tenant-id'] = options.tenantId;
  if (options.mallId) headers['x-mall-id'] = options.mallId;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
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
