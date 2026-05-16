import { appendLimitParam } from './constants';
import { request } from './client';
import type { MediaAsset } from './media';
import type { ContentChannel } from '../content-channels';

export type { ContentChannel } from '../content-channels';
export type SliderChannel = ContentChannel;
export type SliderStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type SliderPlacementType =
  | 'HOME'
  | 'CAMPAIGN'
  | 'EVENT'
  | 'STORE'
  | 'LOCATION'
  | 'CUSTOM';
export type SliderLinkedEntityType = 'CAMPAIGN' | 'EVENT' | 'STORE' | 'LOCATION';

export type SliderMediaPreview = Pick<MediaAsset, 'id' | 'publicUrl' | 'originalName' | 'mimeType'>;

export type SliderItem = {
  id: string;
  sliderId: string;
  title: string | null;
  description: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  desktopMediaId: string | null;
  mobileMediaId: string | null;
  sortOrder: number;
  status: SliderStatus;
  createdAt: string;
  updatedAt: string;
  desktopMedia: SliderMediaPreview | null;
  mobileMedia: SliderMediaPreview | null;
};

export type Slider = {
  id: string;
  tenantId: string;
  mallId: string | null;
  title: string;
  placementType: SliderPlacementType;
  linkedEntityType: SliderLinkedEntityType | null;
  linkedEntityId: string | null;
  startAt: string | null;
  endAt: string | null;
  sortOrder: number;
  status: SliderStatus;
  channels: SliderChannel[];
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: SliderItem[];
  _count?: { items: number };
};

export type SliderListResponse = { sliders: Slider[]; total: number; page: number; limit: number };

export type CreateSliderPayload = {
  title: string;
  placementType?: SliderPlacementType;
  linkedEntityType?: SliderLinkedEntityType;
  linkedEntityId?: string;
  startAt?: string;
  endAt?: string;
  sortOrder?: number;
  status?: SliderStatus;
  channels?: SliderChannel[];
};

export type UpdateSliderPayload = Partial<
  Omit<CreateSliderPayload, 'linkedEntityType' | 'linkedEntityId'>
> & {
  linkedEntityType?: SliderLinkedEntityType | null;
  linkedEntityId?: string | null;
};

export type CreateSliderItemPayload = {
  title?: string;
  description?: string;
  buttonText?: string;
  linkUrl?: string;
  desktopMediaId?: string;
  mobileMediaId?: string;
  sortOrder?: number;
  status?: SliderStatus;
};

export type ReorderItem = { id: string; sortOrder: number };

export async function apiSlidersList(
  token: string,
  tenantId: string,
  opts?: {
    mallId?: string;
    status?: SliderStatus;
    placementType?: SliderPlacementType;
    linkedEntityType?: SliderLinkedEntityType;
    linkedEntityId?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
): Promise<SliderListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.placementType) params.set('placementType', opts.placementType);
  if (opts?.linkedEntityType) params.set('linkedEntityType', opts.linkedEntityType);
  if (opts?.linkedEntityId) params.set('linkedEntityId', opts.linkedEntityId);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.page) params.set('page', String(opts.page));
  appendLimitParam(params, opts?.limit);
  const qs = params.toString();
  return request<SliderListResponse>(`/sliders${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    ...(opts?.mallId ? { mallId: opts.mallId } : {}),
  });
}

export async function apiSliderGet(token: string, tenantId: string, id: string): Promise<Slider> {
  return request<Slider>(`/sliders/${id}`, { method: 'GET', token, tenantId });
}

export async function apiSliderCreate(
  token: string,
  tenantId: string,
  payload: CreateSliderPayload,
  mallId?: string,
): Promise<Slider> {
  return request<Slider>('/sliders', {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiSliderUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: UpdateSliderPayload,
): Promise<Slider> {
  return request<Slider>(`/sliders/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export async function apiSliderDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/sliders/${id}`, { method: 'DELETE', token, tenantId });
}

export async function apiSliderPublish(token: string, tenantId: string, id: string): Promise<Slider> {
  return request<Slider>(`/sliders/${id}/publish`, { method: 'POST', token, tenantId });
}

export async function apiSliderArchive(token: string, tenantId: string, id: string): Promise<Slider> {
  return request<Slider>(`/sliders/${id}/archive`, { method: 'POST', token, tenantId });
}

export async function apiSliderReorder(
  token: string,
  tenantId: string,
  items: ReorderItem[],
  mallId?: string,
): Promise<void> {
  return request<void>('/sliders/reorder', {
    method: 'PATCH',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify({ items }),
  });
}

export async function apiSliderItemsList(
  token: string,
  tenantId: string,
  sliderId: string,
): Promise<SliderItem[]> {
  return request<SliderItem[]>(`/sliders/${sliderId}/items`, { method: 'GET', token, tenantId });
}

export async function apiSliderItemCreate(
  token: string,
  tenantId: string,
  sliderId: string,
  payload: CreateSliderItemPayload,
): Promise<SliderItem> {
  return request<SliderItem>(`/sliders/${sliderId}/items`, {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export async function apiSliderItemUpdate(
  token: string,
  tenantId: string,
  sliderId: string,
  itemId: string,
  payload: Partial<CreateSliderItemPayload>,
): Promise<SliderItem> {
  return request<SliderItem>(`/sliders/${sliderId}/items/${itemId}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export async function apiSliderItemDelete(
  token: string,
  tenantId: string,
  sliderId: string,
  itemId: string,
): Promise<void> {
  return request<void>(`/sliders/${sliderId}/items/${itemId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function apiSliderItemsReorder(
  token: string,
  tenantId: string,
  sliderId: string,
  items: ReorderItem[],
): Promise<void> {
  return request<void>(`/sliders/${sliderId}/items/reorder`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify({ items }),
  });
}
