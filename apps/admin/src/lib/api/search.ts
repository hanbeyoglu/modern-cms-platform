import { request } from './client';

export type SearchIndexEntityType =
  | 'PAGE'
  | 'EVENT'
  | 'CAMPAIGN'
  | 'GLOBAL_STORE'
  | 'MALL_STORE'
  | 'MOVIE'
  | 'CINEMA'
  | 'SLIDER';

export type GlobalSearchHit = {
  id: string;
  title: string;
  entityType: SearchIndexEntityType;
  status: string;
  score: number;
  url: string;
  slug: string | null;
  mallId: string | null;
  mallSlug: string | null;
  mallName: string | null;
  tenantId: string | null;
};

export type GlobalSearchResponse = {
  pages: GlobalSearchHit[];
  events: GlobalSearchHit[];
  campaigns: GlobalSearchHit[];
  stores: GlobalSearchHit[];
  movies: GlobalSearchHit[];
  cinemas: GlobalSearchHit[];
  sliders: GlobalSearchHit[];
};

export type GlobalSearchParams = {
  q: string;
  limit?: number;
};

export function apiGlobalSearch(
  token: string,
  tenantId: string,
  mallId: string | undefined,
  params: GlobalSearchParams,
): Promise<GlobalSearchResponse> {
  const sp = new URLSearchParams();
  sp.set('q', params.q);
  if (params.limit != null) sp.set('limit', String(params.limit));
  return request<GlobalSearchResponse>(`/search/global?${sp.toString()}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}
