import { request } from './client';

/** Prisma `LocalizedEntityType` ile uyumlu stringler. */
export type LocalizedEntityType =
  | 'PAGE'
  | 'PAGE_BLOCK'
  | 'SLIDER'
  | 'SLIDER_ITEM'
  | 'EVENT'
  | 'CAMPAIGN'
  | 'LOCATION'
  | 'STORE'
  | 'STORE_CATEGORY'
  | 'MOVIE'
  | 'CINEMA'
  | 'POPUP'
  | 'SERVICE'
  | 'MALL_FLOOR';

export type LocalizedContentRow = {
  id: string;
  tenantId: string;
  localeId: string;
  entityType: LocalizedEntityType;
  entityId: string;
  field: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type ListTranslationsParams = {
  entityType?: LocalizedEntityType;
  entityId?: string;
  localeId?: string;
  localeCode?: string;
  field?: string;
};

export async function apiTranslationsList(
  token: string,
  tenantId: string,
  params: ListTranslationsParams,
): Promise<LocalizedContentRow[]> {
  const qs = new URLSearchParams();
  if (params.entityType) qs.set('entityType', params.entityType);
  if (params.entityId) qs.set('entityId', params.entityId);
  if (params.localeId) qs.set('localeId', params.localeId);
  if (params.localeCode) qs.set('localeCode', params.localeCode);
  if (params.field) qs.set('field', params.field);
  const q = qs.toString();
  return request<LocalizedContentRow[]>(`/translations${q ? `?${q}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export type UpsertTranslationPayload = {
  localeId?: string;
  localeCode?: string;
  entityType: LocalizedEntityType;
  entityId: string;
  field: string;
  value: string;
};

export async function apiTranslationUpsert(
  token: string,
  tenantId: string,
  body: UpsertTranslationPayload,
): Promise<LocalizedContentRow> {
  return request<LocalizedContentRow>('/translations', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiTranslationDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/translations/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}
