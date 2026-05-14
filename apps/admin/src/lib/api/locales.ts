import { request } from './client';

export type CmsLocale = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  nativeName: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateLocalePayload = {
  code: string;
  name: string;
  nativeName: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export type UpdateLocalePayload = {
  code?: string;
  name?: string;
  nativeName?: string;
  isActive?: boolean;
};

export async function apiLocalesList(
  token: string,
  tenantId: string,
  opts?: { isActive?: boolean },
): Promise<CmsLocale[]> {
  const params = new URLSearchParams();
  if (opts?.isActive !== undefined) params.set('isActive', String(opts.isActive));
  const qs = params.toString();
  return request<CmsLocale[]>(`/locales${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiLocaleCreate(
  token: string,
  tenantId: string,
  body: CreateLocalePayload,
): Promise<CmsLocale> {
  return request<CmsLocale>('/locales', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiLocaleUpdate(
  token: string,
  tenantId: string,
  id: string,
  body: UpdateLocalePayload,
): Promise<CmsLocale> {
  return request<CmsLocale>(`/locales/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

/** Sunucu varsayılan dili pasifleştirerek kaldırır (LocalizedContent korunur). */
export async function apiLocaleDeactivate(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/locales/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function apiLocaleSetDefault(token: string, tenantId: string, id: string): Promise<CmsLocale> {
  return request<CmsLocale>(`/locales/${id}/default`, {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({}),
  });
}
