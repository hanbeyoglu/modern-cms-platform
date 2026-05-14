import type { SearchIndexEntityType } from '@prisma/client';

export type SearchEntityType = SearchIndexEntityType;

export const SEARCH_ENTITY_PERMISSION: Record<SearchIndexEntityType, string> = {
  PAGE: 'page:read',
  EVENT: 'event:read',
  CAMPAIGN: 'campaign:read',
  GLOBAL_STORE: 'global-store:read',
  MALL_STORE: 'mall-store:read',
  MOVIE: 'movie:read',
  CINEMA: 'cinema:read',
  SLIDER: 'slider:read',
};

export interface GlobalSearchHitDto {
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
}

export interface GlobalSearchResponseDto {
  pages: GlobalSearchHitDto[];
  events: GlobalSearchHitDto[];
  campaigns: GlobalSearchHitDto[];
  stores: GlobalSearchHitDto[];
  movies: GlobalSearchHitDto[];
  cinemas: GlobalSearchHitDto[];
  sliders: GlobalSearchHitDto[];
}

export interface PublicSearchHitDto {
  id: string;
  title: string;
  entityType: SearchIndexEntityType;
  score: number;
  path: string;
  slug: string | null;
}

export interface PublicSearchResponseDto {
  results: PublicSearchHitDto[];
}
