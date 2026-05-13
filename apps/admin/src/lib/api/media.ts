import { request } from './client';

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
  storageKey: string;
  publicUrl: string;
  altText: string | null;
  createdAt: string;
};

export type MediaFolder = {
  id: string;
  tenantId: string;
  mallId: string | null;
  parentId: string | null;
  name: string;
  slug: string;
  createdAt: string;
};

export type MediaListResponse = { assets: MediaAsset[]; total: number };
export type FolderListResponse = { folders: MediaFolder[] };

export async function apiMediaUpload(
  token: string,
  tenantId: string,
  file: File,
  opts?: { folderId?: string; mallId?: string; altText?: string },
): Promise<MediaAsset> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.folderId) form.append('folderId', opts.folderId);
  if (opts?.altText) form.append('altText', opts.altText);

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
  opts?: { folderId?: string; mallId?: string; page?: number; limit?: number },
): Promise<MediaListResponse> {
  const params = new URLSearchParams();
  if (opts?.folderId) params.set('folderId', opts.folderId);
  if (opts?.mallId) params.set('mallId', opts.mallId);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<MediaListResponse>(`/media${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiMediaDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/media/${id}`, { method: 'DELETE', token, tenantId });
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
