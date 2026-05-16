import { request } from './client';

export type StoreCategoryStatus = 'ACTIVE' | 'PASSIVE';
export type StoreStatus = 'ACTIVE' | 'PASSIVE' | 'ARCHIVED';

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  status: StoreCategoryStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoreCategoryListResponse = {
  items: StoreCategory[];
  total: number;
  page: number;
  limit: number;
};

export type GlobalStoreCategoryPreview = {
  id: string;
  name: string;
  slug: string;
  status: StoreCategoryStatus;
};

export type GlobalStoreMediaPreview = {
  id: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
};

export type GlobalStore = {
  id: string;
  name: string;
  slug: string;
  logoMediaId: string | null;
  categoryId: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  socialLinksJson: Record<string, unknown> | null;
  status: StoreStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  logoMedia: GlobalStoreMediaPreview | null;
  /** @deprecated Brand-level stores are not categorized; use MallStore categories. */
  category: GlobalStoreCategoryPreview | null;
};

export type GlobalStoreListResponse = {
  items: GlobalStore[];
  total: number;
  page: number;
  limit: number;
};

export type MallStore = {
  id: string;
  tenantId: string;
  mallId: string;
  globalStoreId: string;
  localName: string | null;
  localDescription: string | null;
  localLogoMediaId: string | null;
  floor: string | null;
  storeNo: string | null;
  phone: string | null;
  email: string | null;
  workingHoursJson: Record<string, unknown> | null;
  locationJson: Record<string, unknown> | null;
  isFeatured: boolean;
  isSoon: boolean;
  searchTags: string[];
  sortOrder: number;
  status: StoreStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  globalStore: GlobalStore;
  localLogoMedia: GlobalStoreMediaPreview | null;
  categoryLinks?: { storeCategory: GlobalStoreCategoryPreview }[];
  categories?: GlobalStoreCategoryPreview[];
};

export type MallStoreListResponse = {
  items: MallStore[];
  total: number;
  page: number;
  limit: number;
};

// ─── Store Categories ─────────────────────────────────────────────────────────

export async function apiStoreCategoriesList(
  token: string,
  tenantId: string,
  opts?: { search?: string; status?: StoreCategoryStatus; page?: number; limit?: number },
): Promise<StoreCategoryListResponse> {
  const params = new URLSearchParams();
  if (opts?.search) params.set('search', opts.search);
  if (opts?.status) params.set('status', opts.status);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<StoreCategoryListResponse>(`/store-categories${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiStoreCategoryCreate(
  token: string,
  tenantId: string,
  body: { name: string; slug?: string; icon?: string; sortOrder?: number; status?: StoreCategoryStatus },
): Promise<StoreCategory> {
  return request<StoreCategory>('/store-categories', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiStoreCategoryUpdate(
  token: string,
  tenantId: string,
  id: string,
  body: Partial<{ name: string; slug: string; icon: string | null; sortOrder: number; status: StoreCategoryStatus }>,
): Promise<StoreCategory> {
  return request<StoreCategory>(`/store-categories/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiStoreCategoryDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/store-categories/${id}`, { method: 'DELETE', token, tenantId });
}

// ─── Global Stores ────────────────────────────────────────────────────────────

export async function apiGlobalStoresList(
  token: string,
  tenantId: string,
  opts?: { search?: string; categoryId?: string; status?: StoreStatus; page?: number; limit?: number },
): Promise<GlobalStoreListResponse> {
  const params = new URLSearchParams();
  if (opts?.search) params.set('search', opts.search);
  if (opts?.categoryId) params.set('categoryId', opts.categoryId);
  if (opts?.status) params.set('status', opts.status);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<GlobalStoreListResponse>(`/global-stores${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiGlobalStoreGet(token: string, tenantId: string, id: string): Promise<GlobalStore> {
  return request<GlobalStore>(`/global-stores/${id}`, { method: 'GET', token, tenantId });
}

export async function apiGlobalStoreCreate(
  token: string,
  tenantId: string,
  body: {
    name: string;
    slug?: string;
    logoMediaId?: string;
    description?: string;
    phone?: string;
    email?: string;
    websiteUrl?: string;
    socialLinksJson?: Record<string, unknown>;
    status?: StoreStatus;
  },
): Promise<GlobalStore> {
  return request<GlobalStore>('/global-stores', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiGlobalStoreUpdate(
  token: string,
  tenantId: string,
  id: string,
  body: Partial<{
    name: string;
    slug: string;
    logoMediaId: string | null;
    description: string | null;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    socialLinksJson: Record<string, unknown> | null;
    status: StoreStatus;
  }>,
): Promise<GlobalStore> {
  return request<GlobalStore>(`/global-stores/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiGlobalStoreDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/global-stores/${id}`, { method: 'DELETE', token, tenantId });
}

// ─── Mall Stores ──────────────────────────────────────────────────────────────

export async function apiMallStoresList(
  token: string,
  tenantId: string,
  mallId: string,
  opts?: { search?: string; categoryId?: string; status?: StoreStatus; isFeatured?: boolean; page?: number; limit?: number },
): Promise<MallStoreListResponse> {
  const params = new URLSearchParams();
  if (opts?.search) params.set('search', opts.search);
  if (opts?.categoryId) params.set('categoryId', opts.categoryId);
  if (opts?.status) params.set('status', opts.status);
  if (opts?.isFeatured === true || opts?.isFeatured === false) {
    params.set('isFeatured', opts.isFeatured ? 'true' : 'false');
  }
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<MallStoreListResponse>(`/mall-stores${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export async function apiMallStoreGet(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<MallStore> {
  return request<MallStore>(`/mall-stores/${id}`, { method: 'GET', token, tenantId, mallId });
}

export async function apiMallStoreAssign(
  token: string,
  tenantId: string,
  mallId: string,
  body: {
    globalStoreId: string;
    localName?: string;
    localDescription?: string;
    floor?: string;
    storeNo?: string;
    workingHoursJson?: Record<string, unknown>;
    locationJson?: Record<string, unknown>;
    isFeatured?: boolean;
    isSoon?: boolean;
    searchTags?: string[];
    sortOrder?: number;
    status?: StoreStatus;
    categoryIds?: string[];
  },
): Promise<MallStore> {
  return request<MallStore>('/mall-stores/assign', {
    method: 'POST',
    token,
    tenantId,
    mallId,
    body: JSON.stringify(body),
  });
}

export async function apiMallStoreUpdate(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
  body: Partial<{
    localName: string | null;
    localDescription: string | null;
    floor: string | null;
    storeNo: string | null;
    workingHoursJson: Record<string, unknown> | null;
    locationJson: Record<string, unknown> | null;
    isFeatured: boolean;
    isSoon?: boolean;
    searchTags?: string[];
    sortOrder: number;
    status: StoreStatus;
    categoryIds?: string[];
  }>,
): Promise<MallStore> {
  return request<MallStore>(`/mall-stores/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    mallId,
    body: JSON.stringify(body),
  });
}

export async function apiMallStoreDelete(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<void> {
  return request<void>(`/mall-stores/${id}`, { method: 'DELETE', token, tenantId, mallId });
}

export async function apiMallStoreFeature(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<MallStore> {
  return request<MallStore>(`/mall-stores/${id}/feature`, { method: 'POST', token, tenantId, mallId });
}

export async function apiMallStoreUnfeature(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<MallStore> {
  return request<MallStore>(`/mall-stores/${id}/unfeature`, { method: 'POST', token, tenantId, mallId });
}
