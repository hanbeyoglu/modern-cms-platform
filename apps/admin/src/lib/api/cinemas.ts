import { request } from './client';
import type { MediaAsset } from './media';

export type CinemaStatus = 'ACTIVE' | 'PASSIVE' | 'ARCHIVED';
export type CinemaProviderType = 'MANUAL' | 'API' | 'XML_FEED';

export type CinemaMediaPreview = Pick<MediaAsset, 'id' | 'publicUrl' | 'originalName' | 'mimeType'>;

export type CmsCinema = {
  id: string;
  tenantId: string;
  mallId: string;
  name: string;
  slug: string;
  logoMediaId: string | null;
  description: string | null;
  providerType: CinemaProviderType;
  providerConfigJson: Record<string, unknown> | null;
  status: CinemaStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  logoMedia: CinemaMediaPreview | null;
};

export type CinemaListResponse = { cinemas: CmsCinema[]; total: number; page: number; limit: number };

export type CreateCinemaPayload = {
  name: string;
  slug?: string;
  logoMediaId?: string;
  description?: string;
  providerType?: CinemaProviderType;
  providerConfigJson?: Record<string, unknown>;
  status?: CinemaStatus;
};

export async function apiCinemasList(
  token: string,
  tenantId: string,
  mallId: string,
  opts?: {
    status?: CinemaStatus;
    search?: string;
    sortBy?: 'name' | 'createdAt' | 'slug';
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  },
): Promise<CinemaListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<CinemaListResponse>(`/cinemas${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export async function apiCinemaGet(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<CmsCinema> {
  return request<CmsCinema>(`/cinemas/${id}`, { method: 'GET', token, tenantId, mallId });
}

export async function apiCinemaCreate(
  token: string,
  tenantId: string,
  mallId: string,
  body: CreateCinemaPayload,
): Promise<CmsCinema> {
  return request<CmsCinema>('/cinemas', {
    method: 'POST',
    token,
    tenantId,
    mallId,
    body: JSON.stringify(body),
  });
}

export async function apiCinemaUpdate(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
  body: Partial<CreateCinemaPayload>,
): Promise<CmsCinema> {
  return request<CmsCinema>(`/cinemas/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    mallId,
    body: JSON.stringify(body),
  });
}

export async function apiCinemaDelete(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<void> {
  return request<void>(`/cinemas/${id}`, { method: 'DELETE', token, tenantId, mallId });
}
