import { request } from './client';
import type { CmsLocale, CreateLocalePayload, UpdateLocalePayload } from './locales';

export type { CmsLocale, CreateLocalePayload, UpdateLocalePayload };

export async function apiSystemLocalesList(
  token: string,
  tenantId: string,
  opts?: { isActive?: boolean },
): Promise<CmsLocale[]> {
  const params = new URLSearchParams();
  if (opts?.isActive !== undefined) params.set('isActive', String(opts.isActive));
  const qs = params.toString();
  return request<CmsLocale[]>(`/system/locales${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiSystemLocaleCreate(
  token: string,
  tenantId: string,
  body: CreateLocalePayload,
): Promise<CmsLocale> {
  return request<CmsLocale>('/system/locales', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiSystemLocaleUpdate(
  token: string,
  tenantId: string,
  id: string,
  body: UpdateLocalePayload,
): Promise<CmsLocale> {
  return request<CmsLocale>(`/system/locales/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiSystemLocaleDeactivate(
  token: string,
  tenantId: string,
  id: string,
): Promise<void> {
  return request<void>(`/system/locales/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function apiSystemLocaleSetDefault(
  token: string,
  tenantId: string,
  id: string,
): Promise<CmsLocale> {
  return request<CmsLocale>(`/system/locales/${id}/default`, {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({}),
  });
}

export async function apiSystemLocalesReorder(
  token: string,
  tenantId: string,
  orderedIds: string[],
): Promise<CmsLocale[]> {
  return request<CmsLocale[]>('/system/locales/reorder', {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify({ orderedIds }),
  });
}
