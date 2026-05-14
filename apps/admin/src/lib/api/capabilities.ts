import { request } from './client';

export type CapabilityCategory =
  | 'CORE' | 'CONTENT' | 'OPERATIONS' | 'ANALYTICS'
  | 'LOCALIZATION' | 'PUBLIC_DELIVERY' | 'SEARCH' | 'CDP' | 'AI' | 'INTEGRATION';

export type Capability = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: CapabilityCategory;
  isSystem: boolean;
};

export type TenantCapabilityRow = Capability & {
  enabled: boolean;
  enabledAt: string | null;
  disabledAt: string | null;
};

export type CapabilityListResponse = { capabilities: Capability[] };

export type TenantCapabilityListResponse = {
  tenantId: string;
  capabilities: TenantCapabilityRow[];
};

export async function apiCapabilitiesList(token: string): Promise<CapabilityListResponse> {
  return request<CapabilityListResponse>('/capabilities', { method: 'GET', token });
}

export async function apiTenantCapabilitiesList(
  token: string,
  tenantId: string,
): Promise<TenantCapabilityListResponse> {
  return request<TenantCapabilityListResponse>(`/tenants/${tenantId}/capabilities`, {
    method: 'GET',
    token,
  });
}

export async function apiTenantCapabilitiesUpdate(
  token: string,
  tenantId: string,
  capabilities: Array<{ code: string; enabled: boolean }>,
): Promise<TenantCapabilityListResponse> {
  return request<TenantCapabilityListResponse>(`/tenants/${tenantId}/capabilities`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ capabilities }),
  });
}
