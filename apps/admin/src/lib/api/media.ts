import { request } from './client';

export type MediaAssetStatus = 'ACTIVE' | 'ARCHIVED';

export type MediaAsset = {
  id: string;
  tenantId: string;
  mallId: string | null;
  folderId: string | null;
  originalName: string;
  fileName: string;
  mimeType: string;
  extension: string;
  size: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  storageKey: string;
  publicUrl: string;
  altText: string | null;
  caption: string | null;
  description: string | null;
  tags: string[];
  focalPointX: number | null;
  focalPointY: number | null;
  dominantColor: string | null;
  source: string | null;
  checksum: string | null;
  status: MediaAssetStatus;
  usageContext: string | null;
  suggestedWidth: number | null;
  suggestedHeight: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaFolder = {
  id: string;
  tenantId: string;
  mallId: string | null;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MediaUsage = {
  entityType: string;
  entityId: string;
  entityName: string;
  field: string;
  route?: string;
};

export type MediaListResponse = { assets: MediaAsset[]; total: number };
export type FolderListResponse = { folders: MediaFolder[] };

export type UpdateMediaPayload = {
  altText?: string;
  caption?: string;
  description?: string;
  tags?: string[];
  focalPointX?: number | null;
  focalPointY?: number | null;
  status?: MediaAssetStatus;
};

export async function apiMediaUpload(
  token: string,
  tenantId: string,
  file: File,
  opts?: {
    folderId?: string;
    mallId?: string;
    altText?: string;
    usageContext?: string;
    suggestedWidth?: number;
    suggestedHeight?: number;
    tags?: string[];
  },
): Promise<MediaAsset> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.folderId) form.append('folderId', opts.folderId);
  if (opts?.altText) form.append('altText', opts.altText);
  if (opts?.usageContext) form.append('usageContext', opts.usageContext);
  if (opts?.suggestedWidth != null) form.append('suggestedWidth', String(opts.suggestedWidth));
  if (opts?.suggestedHeight != null) form.append('suggestedHeight', String(opts.suggestedHeight));
  if (opts?.tags?.length) form.append('tags', JSON.stringify(opts.tags));

  return request<MediaAsset>('/media/upload', {
    method: 'POST',
    token,
    tenantId,
    ...(opts?.mallId ? { mallId: opts.mallId } : {}),
    body: form,
  });
}

export async function apiMediaList(
  token: string,
  tenantId: string,
  opts?: {
    folderId?: string;
    mallId?: string;
    page?: number;
    limit?: number;
    mimeType?: string;
    tag?: string;
    search?: string;
    status?: MediaAssetStatus;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<MediaListResponse> {
  const params = new URLSearchParams();
  if (opts?.folderId) params.set('folderId', opts.folderId);
  if (opts?.mallId) params.set('mallId', opts.mallId);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.mimeType) params.set('mimeType', opts.mimeType);
  if (opts?.tag) params.set('tag', opts.tag);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.status) params.set('status', opts.status);
  if (opts?.dateFrom) params.set('dateFrom', opts.dateFrom);
  if (opts?.dateTo) params.set('dateTo', opts.dateTo);
  const qs = params.toString();
  return request<MediaListResponse>(`/media${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiMediaGet(token: string, tenantId: string, id: string): Promise<MediaAsset> {
  return request<MediaAsset>(`/media/${id}`, { method: 'GET', token, tenantId });
}

export async function apiMediaUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: UpdateMediaPayload,
): Promise<MediaAsset> {
  return request<MediaAsset>(`/media/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export async function apiMediaMove(
  token: string,
  tenantId: string,
  id: string,
  folderId: string | null,
): Promise<MediaAsset> {
  return request<MediaAsset>(`/media/${id}/move`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify({ folderId }),
  });
}

export async function apiMediaDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/media/${id}`, { method: 'DELETE', token, tenantId });
}

export async function apiMediaUsages(
  token: string,
  tenantId: string,
  id: string,
): Promise<MediaUsage[]> {
  return request<MediaUsage[]>(`/media/${id}/usages`, { method: 'GET', token, tenantId });
}

export async function apiFoldersList(
  token: string,
  tenantId: string,
  opts?: { parentId?: string; mallId?: string },
): Promise<FolderListResponse> {
  const params = new URLSearchParams();
  if (opts?.parentId) params.set('parentId', opts.parentId);
  if (opts?.mallId) params.set('mallId', opts.mallId);
  const qs = params.toString();
  return request<FolderListResponse>(`/media/folders${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiFolderCreate(
  token: string,
  tenantId: string,
  name: string,
  parentId?: string,
): Promise<MediaFolder> {
  return request<MediaFolder>('/media/folders', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ name, parentId }),
  });
}

export async function apiFolderUpdate(
  token: string,
  tenantId: string,
  id: string,
  payload: { name?: string; sortOrder?: number },
): Promise<MediaFolder> {
  return request<MediaFolder>(`/media/folders/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(payload),
  });
}

export async function apiFolderDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/media/folders/${id}`, { method: 'DELETE', token, tenantId });
}
