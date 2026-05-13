import { request } from './client';

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
  /** RBAC izin kodları (tenant bağlamında). */
  permissions?: string[];
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

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiMe(token: string): Promise<MeResponse> {
  return request<MeResponse>('/auth/me', { method: 'GET', token });
}

export async function apiTenants(token: string): Promise<TenantsResponse> {
  return request<TenantsResponse>('/tenants/my', { method: 'GET', token });
}

export async function apiMalls(token: string, tenantId: string): Promise<MallsResponse> {
  return request<MallsResponse>('/malls/my', { method: 'GET', token, tenantId });
}
