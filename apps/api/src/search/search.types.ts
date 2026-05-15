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
  LOCATION: 'location:read',
  POPUP: 'popup:read',
  SERVICE: 'service:read',
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

/** Frontend-friendly public search result. Each hit is self-contained for rendering. */
export interface PublicSearchHitDto {
  /** Lowercase entity type: 'page' | 'event' | 'campaign' | 'store' | 'movie' | 'cinema' */
  type: string;
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  image: string | null;
  /** Relative API path to fetch the full entity (e.g. /public/events/my-slug) */
  url: string;
  locale: string | null;
}

export interface PublicSearchResponseDto {
  results: PublicSearchHitDto[];
}
