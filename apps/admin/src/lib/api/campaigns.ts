import { appendLimitParam } from './constants';
import { request } from './client';
import type { ContentStatus, ContentChannel, EventMediaPreview } from './events';
import type { GlobalStore } from './stores';

export type MallStoreSummary = {
  id: string;
  mallId: string;
  tenantId: string;
  detailTitle: string | null;
  globalStore: { name: string; slug: string };
};

export type CampaignTranslation = {
  localeId: string;
  title?: string | null;
  description?: string | null;
  buttonText?: string | null;
  coverImageId?: string | null;
  mobileCoverImageId?: string | null;
  locale?: { id: string; code: string };
  coverImage?: EventMediaPreview | null;
  mobileCoverImage?: EventMediaPreview | null;
};

export type CmsCampaign = {
  id: string;
  tenantId: string;
  mallId: string | null;
  storeId: string | null;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  sameImageForAllLocales: boolean;
  sharedCoverImageId: string | null;
  sharedMobileCoverImageId: string | null;
  coverMediaWidthOverride: number | null;
  coverMediaHeightOverride: number | null;
  publishStartAt: string | null;
  publishEndAt: string | null;
  campaignStartAt: string | null;
  campaignEndAt: string | null;
  terms: string | null;
  couponCode: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  status: ContentStatus;
  channels: ContentChannel[];
  sortOrder: number;
  dynamicFieldsJson: Record<string, unknown> | null;
  createdBy: string;
  updatedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sharedCoverImage: EventMediaPreview | null;
  sharedMobileCoverImage: EventMediaPreview | null;
  translations: CampaignTranslation[];
  store: MallStoreSummary | null;
};

export type CampaignListResponse = {
  campaigns: CmsCampaign[];
  total: number;
  page: number;
  limit: number;
};

export type CreateCampaignPayload = {
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  sameImageForAllLocales?: boolean;
  sharedCoverImageId?: string;
  sharedMobileCoverImageId?: string;
  coverMediaWidthOverride?: number | null;
  coverMediaHeightOverride?: number | null;
  publishStartAt?: string;
  publishEndAt?: string;
  campaignStartAt?: string;
  campaignEndAt?: string;
  terms?: string;
  couponCode?: string;
  buttonText?: string;
  linkUrl?: string;
  storeId?: string;
  sortOrder?: number;
  status?: ContentStatus;
  channels?: ContentChannel[];
  translations?: CampaignTranslation[];
  dynamicFieldsJson?: Record<string, unknown>;
};

export async function apiCampaignsList(
  token: string,
  tenantId: string,
  opts?: {
    mallId?: string;
    status?: ContentStatus;
    search?: string;
    storeId?: string;
    sortBy?: 'sortOrder' | 'campaignStartAt' | 'startAt' | 'createdAt';
    sortDir?: 'asc' | 'desc';
    startFrom?: string;
    startTo?: string;
    endFrom?: string;
    endTo?: string;
    page?: number;
    limit?: number;
  },
): Promise<CampaignListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.storeId) params.set('storeId', opts.storeId);
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  if (opts?.startFrom) params.set('startFrom', opts.startFrom);
  if (opts?.startTo) params.set('startTo', opts.startTo);
  if (opts?.endFrom) params.set('endFrom', opts.endFrom);
  if (opts?.endTo) params.set('endTo', opts.endTo);
  if (opts?.page) params.set('page', String(opts.page));
  appendLimitParam(params, opts?.limit);
  const qs = params.toString();
  return request<CampaignListResponse>(`/campaigns${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    ...(opts?.mallId ? { mallId: opts.mallId } : {}),
  });
}

export async function apiCampaignGet(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsCampaign> {
  return request<CmsCampaign>(`/campaigns/${id}`, {
    method: 'GET',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiCampaignCreate(
  token: string,
  tenantId: string,
  payload: CreateCampaignPayload,
  mallId?: string,
): Promise<CmsCampaign> {
  return request<CmsCampaign>('/campaigns', {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiCampaignUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: Partial<CreateCampaignPayload> & { mallId?: string | null; storeId?: string | null },
  mallId?: string,
): Promise<CmsCampaign> {
  return request<CmsCampaign>(`/campaigns/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiCampaignDelete(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<void> {
  return request<void>(`/campaigns/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiCampaignPublish(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsCampaign> {
  return request<CmsCampaign>(`/campaigns/${id}/publish`, {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiCampaignArchive(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsCampaign> {
  return request<CmsCampaign>(`/campaigns/${id}/archive`, {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export type { GlobalStore };
