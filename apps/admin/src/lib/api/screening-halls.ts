import { request } from './client';
import { appendLimitParam } from './constants';

export type ScreeningHall = {
  id: string;
  tenantId: string;
  mallId: string;
  cinemaId: string | null;
  name: string;
  slug: string;
  capacity: number | null;
  is3D: boolean;
  isImax: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ScreeningHallListResponse = {
  halls: ScreeningHall[];
  total: number;
};

export async function apiScreeningHallsList(
  token: string,
  tenantId: string,
  mallId: string,
  opts?: { search?: string; limit?: number },
): Promise<ScreeningHallListResponse> {
  const params = new URLSearchParams();
  if (opts?.search) params.set('search', opts.search);
  appendLimitParam(params, opts?.limit ?? 200);
  const qs = params.toString();
  return request<ScreeningHallListResponse>(`/screening-halls${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export async function apiScreeningHallCreate(
  token: string,
  tenantId: string,
  mallId: string,
  body: { name: string; cinemaId?: string; capacity?: number; is3D?: boolean; isImax?: boolean },
): Promise<ScreeningHall> {
  return request<ScreeningHall>('/screening-halls', {
    method: 'POST',
    token,
    tenantId,
    mallId,
    body: JSON.stringify(body),
  });
}

export async function apiScreeningHallDelete(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<void> {
  return request<void>(`/screening-halls/${id}`, { method: 'DELETE', token, tenantId, mallId });
}
