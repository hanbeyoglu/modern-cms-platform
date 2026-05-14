import { request } from './client';
import type { MediaAsset } from './media';

export type ContentStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export type EventMediaPreview = Pick<MediaAsset, 'id' | 'publicUrl' | 'originalName' | 'mimeType'>;

export type CmsEvent = {
  id: string;
  tenantId: string;
  mallId: string | null;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  coverMediaId: string | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  category: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  status: ContentStatus;
  sortOrder: number;
  dynamicFieldsJson: Record<string, unknown> | null;
  createdBy: string;
  updatedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coverMedia: EventMediaPreview | null;
};

export type EventListResponse = { events: CmsEvent[]; total: number; page: number; limit: number };

export type CreateEventPayload = {
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  coverMediaId?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  category?: string;
  buttonText?: string;
  linkUrl?: string;
  sortOrder?: number;
  status?: ContentStatus;
  dynamicFieldsJson?: Record<string, unknown>;
};

export async function apiEventsList(
  token: string,
  tenantId: string,
  opts?: {
    mallId?: string;
    status?: ContentStatus;
    search?: string;
    category?: string;
    sortBy?: 'sortOrder' | 'startAt' | 'createdAt';
    sortDir?: 'asc' | 'desc';
    startFrom?: string;
    startTo?: string;
    endFrom?: string;
    endTo?: string;
    page?: number;
    limit?: number;
  },
): Promise<EventListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.category) params.set('category', opts.category);
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  if (opts?.startFrom) params.set('startFrom', opts.startFrom);
  if (opts?.startTo) params.set('startTo', opts.startTo);
  if (opts?.endFrom) params.set('endFrom', opts.endFrom);
  if (opts?.endTo) params.set('endTo', opts.endTo);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<EventListResponse>(`/events${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    ...(opts?.mallId ? { mallId: opts.mallId } : {}),
  });
}

export async function apiEventGet(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsEvent> {
  return request<CmsEvent>(`/events/${id}`, {
    method: 'GET',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiEventCreate(
  token: string,
  tenantId: string,
  payload: CreateEventPayload,
  mallId?: string,
): Promise<CmsEvent> {
  return request<CmsEvent>('/events', {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiEventUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: Partial<CreateEventPayload> & { mallId?: string | null },
  mallId?: string,
): Promise<CmsEvent> {
  return request<CmsEvent>(`/events/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiEventDelete(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<void> {
  return request<void>(`/events/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export type EventPublishResponse = {
  event: CmsEvent;
  localizationWarnings: string[];
};

export async function apiEventPublish(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<EventPublishResponse> {
  return request<EventPublishResponse>(`/events/${id}/publish`, {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiEventArchive(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsEvent> {
  return request<CmsEvent>(`/events/${id}/archive`, {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}
