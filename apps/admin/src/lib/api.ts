const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// ─── Response Types ───────────────────────────────────────────────────────────

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isSuperAdmin: boolean;
  };
};

export type MeMembership = {
  tenantId: string;
  tenantName: string;
  role: { code: string; name: string };
  malls: Array<{ id: string; name: string; slug: string }>;
};

export type MeResponse = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isSuperAdmin: boolean;
  status: string;
  tenants: Array<{ id: string; name: string; slug: string; status: string }>;
  memberships: MeMembership[];
};

export type Tenant = { id: string; name: string; slug: string; status: string };
export type TenantsResponse = { tenants: Tenant[] };

export type Mall = { id: string; tenantId: string; name: string; slug: string; status: string };
export type MallsResponse = { malls: Mall[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; tenantId?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.tenantId) headers['x-tenant-id'] = options.tenantId;

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiMe(token: string): Promise<MeResponse> {
  return request<MeResponse>('/auth/me', { method: 'GET', token });
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function apiTenants(token: string): Promise<TenantsResponse> {
  return request<TenantsResponse>('/tenants/my', { method: 'GET', token });
}

// ─── Malls ────────────────────────────────────────────────────────────────────

export async function apiMalls(token: string, tenantId: string): Promise<MallsResponse> {
  return request<MallsResponse>('/malls/my', { method: 'GET', token, tenantId });
}
