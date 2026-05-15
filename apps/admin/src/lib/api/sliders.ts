import { request } from './client';
import type { MediaAsset } from './media';
import type { ContentChannel } from '../content-channels';

export type { ContentChannel } from '../content-channels';
export type SliderChannel = ContentChannel;
export type SliderStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type SliderTargetDevice = 'ALL' | 'DESKTOP' | 'MOBILE';
export type SliderLinkType = 'NONE' | 'EXTERNAL_URL' | 'INTERNAL_PAGE' | 'EVENT' | 'CAMPAIGN' | 'STORE';

export type SliderMediaPreview = Pick<MediaAsset, 'id' | 'publicUrl' | 'originalName' | 'mimeType'>;

export type Slider = {
  id: string;
  tenantId: string;
  mallId: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  desktopMediaId: string | null;
  mobileMediaId: string | null;
  videoMediaId: string | null;
  linkType: SliderLinkType;
  linkValue: string | null;
  buttonText: string | null;
  startAt: string | null;
  endAt: string | null;
  sortOrder: number;
  status: SliderStatus;
  targetDevice: SliderTargetDevice;
  channels: SliderChannel[];
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  desktopMedia: SliderMediaPreview | null;
  mobileMedia: SliderMediaPreview | null;
  videoMedia: SliderMediaPreview | null;
};

export type SliderListResponse = { sliders: Slider[]; total: number; page: number; limit: number };

export type CreateSliderPayload = {
  title: string;
  subtitle?: string;
  description?: string;
  desktopMediaId?: string;
  mobileMediaId?: string;
  videoMediaId?: string;
  linkType?: SliderLinkType;
  linkValue?: string;
  buttonText?: string;
  startAt?: string;
  endAt?: string;
  sortOrder?: number;
  status?: SliderStatus;
  targetDevice?: SliderTargetDevice;
  channels?: SliderChannel[];
};

export type ReorderItem = { id: string; sortOrder: number };

export async function apiSlidersList(
  token: string,
  tenantId: string,
  opts?: {
    mallId?: string;
    status?: SliderStatus;
    targetDevice?: SliderTargetDevice;
    search?: string;
    page?: number;
    limit?: number;
  },
): Promise<SliderListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.targetDevice) params.set('targetDevice', opts.targetDevice);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
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
  payload: Partial<CreateSliderPayload>,
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
