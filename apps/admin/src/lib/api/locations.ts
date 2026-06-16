import { request } from './client';

export type LocationType =
  | 'SHOPPING_MALL'
  | 'STORE'
  | 'MARKET'
  | 'HOTEL'
  | 'HOSPITAL'
  | 'CAMPUS'
  | 'OFFICE'
  | 'RESTAURANT'
  | 'MARINA'
  | 'RESIDENCE'
  | 'AIRPORT'
  | 'CUSTOM';

export type LocationStatus = 'DRAFT' | 'LIVE' | 'MAINTENANCE' | 'CLOSED';

export type CmsLocation = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  type: LocationType;
  status: LocationStatus;
  isPublic: boolean;
  legalName: string | null;
  displayName: string | null;
  shortDescription: string | null;
  description: string | null;
  logoMediaId: string | null;
  coverMediaId: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  workingHoursJson: unknown;
  socialLinksJson: unknown;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
  tenant?: { id: string; name: string; slug: string };
  logoMedia?: { id: string; publicUrl: string } | null;
  coverMedia?: { id: string; publicUrl: string } | null;
};

export type LocationListResponse = { locations: CmsLocation[] };

export type CreateLocationPayload = {
  name: string;
  slug?: string;
  tenantId: string;
  type?: LocationType;
  legalName?: string;
  displayName?: string;
  shortDescription?: string;
  description?: string;
  logoMediaId?: string;
  coverMediaId?: string;
  websiteUrl?: string;
  supportEmail?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  workingHoursJson?: unknown;
  socialLinksJson?: unknown;
  metadataJson?: unknown;
  isPublic?: boolean;
};

export type UpdateLocationPayload = Partial<Omit<CreateLocationPayload, 'tenantId'>>;

export function apiLocationsList(
  token: string,
  params?: { search?: string; type?: string; status?: string; city?: string; tenantId?: string },
): Promise<LocationListResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.type) qs.set('type', params.type);
  if (params?.status) qs.set('status', params.status);
  if (params?.city) qs.set('city', params.city);
  if (params?.tenantId) qs.set('tenantId', params.tenantId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/locations${suffix}`, {
    token,
    ...(params?.tenantId ? { tenantId: params.tenantId } : {}),
  });
}

export function apiLocationGet(token: string, id: string): Promise<CmsLocation> {
  return request(`/locations/${id}`, { token });
}

export function apiLocationCreate(
  token: string,
  data: CreateLocationPayload,
): Promise<CmsLocation> {
  return request('/locations', { method: 'POST', body: JSON.stringify(data), token });
}

export function apiLocationUpdate(
  token: string,
  id: string,
  data: UpdateLocationPayload,
): Promise<CmsLocation> {
  return request(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data), token });
}

export function apiLocationUpdateStatus(
  token: string,
  id: string,
  status: LocationStatus,
): Promise<{ success: boolean; status: string }> {
  return request(`/locations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    token,
  });
}

export function apiLocationDelete(token: string, id: string): Promise<{ success: boolean }> {
  return request(`/locations/${id}`, { method: 'DELETE', token });
}

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  SHOPPING_MALL: 'AVM',
  STORE: 'Mağaza',
  MARKET: 'Market',
  HOTEL: 'Otel',
  HOSPITAL: 'Hastane',
  CAMPUS: 'Kampüs',
  OFFICE: 'Ofis',
  RESTAURANT: 'Restoran',
  MARINA: 'Marina',
  RESIDENCE: 'Konut',
  AIRPORT: 'Havalimanı',
  CUSTOM: 'Özel',
};
