const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// ─── Response Types ───────────────────────────────────────────────────────────

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isSuperAdmin: boolean;
  };
};

export type MeMembership = {
  tenantId: string;
  tenantName: string;
  role: { code: string; name: string };
  malls: Array<{ id: string; name: string; slug: string }>;
};

export type MeResponse = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isSuperAdmin: boolean;
  status: string;
  tenants: Array<{ id: string; name: string; slug: string; status: string }>;
  memberships: MeMembership[];
};

export type Tenant = { id: string; name: string; slug: string; status: string };
export type TenantsResponse = { tenants: Tenant[] };

export type Mall = { id: string; tenantId: string; name: string; slug: string; status: string };
export type MallsResponse = { malls: Mall[] };

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RequestOptions = RequestInit & {
  token?: string;
  tenantId?: string;
  mallId?: string;
};

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {};

  // Do not set Content-Type for FormData — browser sets it with the boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.tenantId) headers['x-tenant-id'] = options.tenantId;
  if (options.mallId) headers['x-mall-id'] = options.mallId;

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiMe(token: string): Promise<MeResponse> {
  return request<MeResponse>('/auth/me', { method: 'GET', token });
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function apiTenants(token: string): Promise<TenantsResponse> {
  return request<TenantsResponse>('/tenants/my', { method: 'GET', token });
}

// ─── Malls ────────────────────────────────────────────────────────────────────

export async function apiMalls(token: string, tenantId: string): Promise<MallsResponse> {
  return request<MallsResponse>('/malls/my', { method: 'GET', token, tenantId });
}

// ─── Media ───────────────────────────────────────────────────────────────────

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

export async function apiMediaDelete(
  token: string,
  tenantId: string,
  id: string,
): Promise<void> {
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

// ─── Sliders ──────────────────────────────────────────────────────────────────

export type SliderStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type SliderTargetDevice = 'ALL' | 'DESKTOP' | 'MOBILE';
export type SliderLinkType = 'NONE' | 'EXTERNAL_URL' | 'INTERNAL_PAGE' | 'EVENT' | 'CAMPAIGN' | 'STORE';

export type SliderMediaPreview = {
  id: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
};

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
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  desktopMedia: SliderMediaPreview | null;
  mobileMedia: SliderMediaPreview | null;
  videoMedia: SliderMediaPreview | null;
};

export type SliderListResponse = {
  sliders: Slider[];
  total: number;
  page: number;
  limit: number;
};

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

export async function apiSliderGet(
  token: string,
  tenantId: string,
  id: string,
): Promise<Slider> {
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

export async function apiSliderDelete(
  token: string,
  tenantId: string,
  id: string,
): Promise<void> {
  return request<void>(`/sliders/${id}`, { method: 'DELETE', token, tenantId });
}

export async function apiSliderPublish(
  token: string,
  tenantId: string,
  id: string,
): Promise<Slider> {
  return request<Slider>(`/sliders/${id}/publish`, { method: 'POST', token, tenantId });
}

export async function apiSliderArchive(
  token: string,
  tenantId: string,
  id: string,
): Promise<Slider> {
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

// ─── Store Categories (global) ────────────────────────────────────────────────

export type StoreCategoryStatus = 'ACTIVE' | 'PASSIVE';

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
  body: {
    name: string;
    slug?: string;
    icon?: string;
    sortOrder?: number;
    status?: StoreCategoryStatus;
  },
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
  body: Partial<{
    name: string;
    slug: string;
    icon: string | null;
    sortOrder: number;
    status: StoreCategoryStatus;
  }>,
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

export type StoreStatus = 'ACTIVE' | 'PASSIVE' | 'ARCHIVED';

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
  websiteUrl: string | null;
  socialLinksJson: Record<string, unknown> | null;
  status: StoreStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  logoMedia: GlobalStoreMediaPreview | null;
  category: GlobalStoreCategoryPreview | null;
};

export type GlobalStoreListResponse = {
  items: GlobalStore[];
  total: number;
  page: number;
  limit: number;
};

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
    categoryId?: string;
    description?: string;
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
    categoryId: string | null;
    description: string | null;
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
  sortOrder: number;
  status: StoreStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  globalStore: GlobalStore;
  localLogoMedia: GlobalStoreMediaPreview | null;
};

export type MallStoreListResponse = {
  items: MallStore[];
  total: number;
  page: number;
  limit: number;
};

export async function apiMallStoresList(
  token: string,
  tenantId: string,
  mallId: string,
  opts?: {
    search?: string;
    categoryId?: string;
    status?: StoreStatus;
    isFeatured?: boolean;
    page?: number;
    limit?: number;
  },
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
    localLogoMediaId?: string;
    floor?: string;
    storeNo?: string;
    phone?: string;
    email?: string | null;
    workingHoursJson?: Record<string, unknown>;
    locationJson?: Record<string, unknown>;
    isFeatured?: boolean;
    sortOrder?: number;
    status?: StoreStatus;
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
    localLogoMediaId: string | null;
    floor: string | null;
    storeNo: string | null;
    phone: string | null;
    email: string | null;
    workingHoursJson: Record<string, unknown> | null;
    locationJson: Record<string, unknown> | null;
    isFeatured: boolean;
    sortOrder: number;
    status: StoreStatus;
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
