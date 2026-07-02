import { request } from './client';
import { apiLocalesList, type CmsLocale } from './locales';

export type LocationLocaleRow = CmsLocale & {
  locationActive: boolean;
};

export async function apiLocationLocalesList(
  token: string,
  tenantId: string,
  locationId: string,
): Promise<LocationLocaleRow[]> {
  return request<LocationLocaleRow[]>(`/locations/${locationId}/locales`, {
    method: 'GET',
    token,
    tenantId,
  });
}

/** @deprecated Use apiLocationLocalesList and filter by locationActive */
export async function apiLocationActiveLocales(
  token: string,
  tenantId: string,
  locationId: string,
): Promise<CmsLocale[]> {
  const rows = await apiLocationLocalesList(token, tenantId, locationId);
  return rows.filter((r) => r.locationActive);
}

export async function apiLocationLocalesUpdate(
  token: string,
  tenantId: string,
  locationId: string,
  body: { locales: Array<{ localeId: string; isActive: boolean }> },
): Promise<LocationLocaleRow[]> {
  return request<LocationLocaleRow[]>(`/locations/${locationId}/locales`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

/** Locales for multilingual content forms — mall-scoped when locationId is set. */
export async function apiContentLocales(
  token: string,
  tenantId: string,
  locationId?: string | null,
): Promise<CmsLocale[]> {
  if (locationId) {
    const rows = await apiLocationLocalesList(token, tenantId, locationId);
    return rows.filter((r) => r.locationActive);
  }
  return apiLocalesList(token, tenantId, { isActive: true });
}
