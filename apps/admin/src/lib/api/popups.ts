import { request } from './client';
import type { MediaAsset } from './media';
import type { ContentChannel } from '../content-channels';

export type { ContentChannel } from '../content-channels';
/** @deprecated Use ContentChannel */
export type Channel = ContentChannel;
export type PopupStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export type PopupMediaPreview = Pick<MediaAsset, 'id' | 'publicUrl' | 'originalName' | 'mimeType'>;

export type CmsPopup = {
  id: string;
  tenantId: string;
  mallId: string | null;
  title: string;
  description: string | null;
  imageMediaId: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  status: PopupStatus;
  channels: ContentChannel[];
  startAt: string | null;
  endAt: string | null;
  sortOrder: number;
  showOnce: boolean;
  closable: boolean;
  createdBy: string;
  updatedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  imageMedia: PopupMediaPreview | null;
};

export type PopupListResponse = { popups: CmsPopup[]; total: number; page: number; limit: number };

export type CreatePopupPayload = {
  title: string;
  description?: string;
  imageMediaId?: string;
  linkUrl?: string;
  buttonText?: string;
  status?: PopupStatus;
  channels?: ContentChannel[];
  startAt?: string;
  endAt?: string;
  sortOrder?: number;
  showOnce?: boolean;
  closable?: boolean;
};

export async function apiPopupsList(
  token: string,
  tenantId: string,
  opts?: {
    mallId?: string;
    status?: PopupStatus;
    search?: string;
    page?: number;
    limit?: number;
  },
): Promise<PopupListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<PopupListResponse>(`/popups${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    ...(opts?.mallId ? { mallId: opts.mallId } : {}),
  });
}

export async function apiPopupGet(token: string, tenantId: string, id: string): Promise<CmsPopup> {
  return request<CmsPopup>(`/popups/${id}`, { method: 'GET', token, tenantId });
}

export async function apiPopupCreate(
  token: string,
  tenantId: string,
  payload: CreatePopupPayload,
  mallId?: string,
): Promise<CmsPopup> {
  return request<CmsPopup>('/popups', {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiPopupUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: Partial<CreatePopupPayload>,
): Promise<CmsPopup> {
  return request<CmsPopup>(`/popups/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export async function apiPopupDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/popups/${id}`, { method: 'DELETE', token, tenantId });
}

export async function apiPopupPublish(token: string, tenantId: string, id: string): Promise<CmsPopup> {
  return request<CmsPopup>(`/popups/${id}/publish`, { method: 'POST', token, tenantId });
}

export async function apiPopupArchive(token: string, tenantId: string, id: string): Promise<CmsPopup> {
  return request<CmsPopup>(`/popups/${id}/archive`, { method: 'POST', token, tenantId });
}
