import { request } from './client';
import type { MediaAsset } from './media';

export type ServiceStatus = 'ACTIVE' | 'INACTIVE';

export type ServiceMediaPreview = Pick<MediaAsset, 'id' | 'publicUrl' | 'originalName' | 'mimeType'>;

export type CmsService = {
  id: string;
  tenantId: string;
  mallId: string;
  name: string;
  description: string | null;
  iconMediaId: string | null;
  coverMediaId: string | null;
  category: string | null;
  floor: string | null;
  unitNo: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  locationLabel: string | null;
  searchTags: string[];
  isSoon: boolean;
  status: ServiceStatus;
  sortOrder: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  iconMedia: ServiceMediaPreview | null;
  coverMedia: ServiceMediaPreview | null;
};

export type ServiceListResponse = { services: CmsService[]; total: number; page: number; limit: number };

export type CreateServicePayload = {
  name: string;
  description?: string;
  iconMediaId?: string;
  coverMediaId?: string;
  category?: string;
  floor?: string;
  unitNo?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  locationLabel?: string;
  searchTags?: string[];
  isSoon?: boolean;
  status?: ServiceStatus;
  sortOrder?: number;
  mallId?: string;
};

export async function apiServicesList(
  token: string,
  tenantId: string,
  opts?: {
    mallId?: string;
    status?: ServiceStatus;
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  },
): Promise<ServiceListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.category) params.set('category', opts.category);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<ServiceListResponse>(`/services${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    ...(opts?.mallId ? { mallId: opts.mallId } : {}),
  });
}

export async function apiServiceGet(token: string, tenantId: string, id: string): Promise<CmsService> {
  return request<CmsService>(`/services/${id}`, { method: 'GET', token, tenantId });
}

export async function apiServiceCreate(
  token: string,
  tenantId: string,
  payload: CreateServicePayload,
  mallId?: string,
): Promise<CmsService> {
  return request<CmsService>('/services', {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiServiceUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: Partial<CreateServicePayload>,
): Promise<CmsService> {
  return request<CmsService>(`/services/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export async function apiServiceDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/services/${id}`, { method: 'DELETE', token, tenantId });
}
