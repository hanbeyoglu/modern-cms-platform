import { request } from './client';

export type PageStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type PageType = 'STANDARD' | 'LANDING' | 'LEGAL' | 'CONTACT' | 'CUSTOM';
export type PageBlockStatus = 'ACTIVE' | 'PASSIVE';

export type CmsPageBlock = {
  id: string;
  type: string;
  title: string | null;
  dataJson: Record<string, unknown>;
  sortOrder: number;
  status: PageBlockStatus;
  createdAt: string;
  updatedAt: string;
};

export type CmsPage = {
  id: string;
  tenantId: string;
  mallId: string | null;
  title: string;
  slug: string;
  type: PageType;
  status: PageStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishAt: string | null;
  unpublishAt: string | null;
  createdBy: string;
  updatedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  blocks: CmsPageBlock[];
};

export type PageListResponse = {
  pages: CmsPage[];
  total: number;
  page: number;
  limit: number;
};

export type CreatePagePayload = {
  title: string;
  slug?: string;
  type?: PageType;
  status?: PageStatus;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  publishAt?: string;
  unpublishAt?: string;
};

export type CreatePageBlockPayload = {
  type: string;
  title?: string;
  dataJson?: Record<string, unknown>;
  sortOrder?: number;
  status?: PageBlockStatus;
};

export type ReorderBlocksPayload = {
  blocks: { id: string; sortOrder: number }[];
};

export async function apiPagesList(
  token: string,
  tenantId: string,
  opts?: {
    mallId?: string;
    status?: PageStatus;
    type?: PageType;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'title';
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  },
): Promise<PageListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.type) params.set('type', opts.type);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<PageListResponse>(`/pages${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    ...(opts?.mallId ? { mallId: opts.mallId } : {}),
  });
}

export async function apiPageGet(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsPage> {
  return request<CmsPage>(`/pages/${id}`, {
    method: 'GET',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiPageCreate(
  token: string,
  tenantId: string,
  payload: CreatePagePayload,
  mallId?: string,
): Promise<CmsPage> {
  return request<CmsPage>('/pages', {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiPageUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: Partial<CreatePagePayload>,
  mallId?: string,
): Promise<CmsPage> {
  return request<CmsPage>(`/pages/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiPageDelete(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<void> {
  return request<void>(`/pages/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiPagePublish(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsPage> {
  return request<CmsPage>(`/pages/${id}/publish`, {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiPageArchive(
  token: string,
  tenantId: string,
  id: string,
  mallId?: string,
): Promise<CmsPage> {
  return request<CmsPage>(`/pages/${id}/archive`, {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

// ── Page Blocks ──────────────────────────────────────────────────────────────

export async function apiPageBlocksList(
  token: string,
  tenantId: string,
  pageId: string,
  mallId?: string,
): Promise<CmsPageBlock[]> {
  return request<CmsPageBlock[]>(`/pages/${pageId}/blocks`, {
    method: 'GET',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiPageBlockCreate(
  token: string,
  tenantId: string,
  pageId: string,
  payload: CreatePageBlockPayload,
  mallId?: string,
): Promise<CmsPageBlock> {
  return request<CmsPageBlock>(`/pages/${pageId}/blocks`, {
    method: 'POST',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiPageBlockUpdate(
  token: string,
  tenantId: string,
  pageId: string,
  blockId: string,
  payload: Partial<CreatePageBlockPayload>,
  mallId?: string,
): Promise<CmsPageBlock> {
  return request<CmsPageBlock>(`/pages/${pageId}/blocks/${blockId}`, {
    method: 'PATCH',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}

export async function apiPageBlockDelete(
  token: string,
  tenantId: string,
  pageId: string,
  blockId: string,
  mallId?: string,
): Promise<void> {
  return request<void>(`/pages/${pageId}/blocks/${blockId}`, {
    method: 'DELETE',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}

export async function apiPageBlocksReorder(
  token: string,
  tenantId: string,
  pageId: string,
  payload: ReorderBlocksPayload,
  mallId?: string,
): Promise<CmsPageBlock[]> {
  return request<CmsPageBlock[]>(`/pages/${pageId}/blocks/reorder`, {
    method: 'PATCH',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
    body: JSON.stringify(payload),
  });
}
