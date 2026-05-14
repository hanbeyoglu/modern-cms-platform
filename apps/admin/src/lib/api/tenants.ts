import { request } from './client';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'ARCHIVED';

export type CmsTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  billingEmail: string | null;
  addressJson: unknown;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
  _count?: { tenantUsers: number };
  malls?: Array<{ id: string; name: string; slug: string; type: string; status: string; city: string | null }>;
  capabilities?: Array<{
    enabled: boolean;
    capability: { code: string; name: string; category: string };
  }>;
};

export type TenantListResponse = { tenants: CmsTenant[] };

export type CreateTenantPayload = {
  name: string;
  slug?: string;
  status?: TenantStatus;
  legalName?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  billingEmail?: string;
  addressJson?: unknown;
  metadataJson?: unknown;
};

export type UpdateTenantPayload = Partial<Omit<CreateTenantPayload, 'status'>>;

export function apiTenantsList(
  token: string,
  params?: { search?: string; status?: string },
): Promise<TenantListResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/tenants${suffix}`, { token });
}

export function apiTenantGet(token: string, id: string): Promise<CmsTenant> {
  return request(`/tenants/${id}`, { token });
}

export function apiTenantCreate(token: string, data: CreateTenantPayload): Promise<CmsTenant> {
  return request('/tenants', { method: 'POST', body: JSON.stringify(data), token });
}

export function apiTenantUpdate(
  token: string,
  id: string,
  data: UpdateTenantPayload,
): Promise<CmsTenant> {
  return request(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data), token });
}

export function apiTenantUpdateStatus(
  token: string,
  id: string,
  status: TenantStatus,
): Promise<{ success: boolean; status: string }> {
  return request(`/tenants/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), token });
}
