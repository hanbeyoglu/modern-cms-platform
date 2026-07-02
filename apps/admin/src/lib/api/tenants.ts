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

export type TenantDeletePreviewCounts = {
  malls: number;
  users: number;
  mallStores: number;
  campaigns: number;
  events: number;
  media: number;
  movies: number;
  movieSessions: number;
  screeningHalls: number;
  sliders: number;
  popups: number;
  pages: number;
  services: number;
  storeCategories: number;
  mallFloors: number;
  locales: number;
  localizedContent: number;
  searchIndexEntries: number;
  notifications: number;
  movieSyncLogs: number;
  cinemas: number;
  movieCategories: number;
  pageBlocks: number;
  pageAttachments: number;
  analyticsEvents: number;
  tenantSettings: number;
  tenantCapabilities: number;
};

export type TenantDeletePreview = {
  tenant: { id: string; name: string; slug: string; status: TenantStatus; deletedAt: string | null };
  counts: TenantDeletePreviewCounts;
  isProtected: boolean;
  isActorOnlyTenant: boolean;
  confirmHint: string;
};

export type TenantDeleteMode = 'SOFT' | 'HARD';

export type TenantDeleteResult = {
  mode: TenantDeleteMode;
  tenantId: string;
  deleted: TenantDeletePreviewCounts;
  deletedMediaCount: number;
  failedMediaDeletes: number;
  warnings: string[];
};

export function apiTenantDeletePreview(token: string, id: string): Promise<TenantDeletePreview> {
  return request(`/system/tenants/${id}/delete-preview`, { token });
}

export function apiTenantDelete(
  token: string,
  id: string,
  data: { mode: TenantDeleteMode; confirmSlug: string },
): Promise<TenantDeleteResult> {
  return request(`/system/tenants/${id}`, { method: 'DELETE', body: JSON.stringify(data), token });
}
