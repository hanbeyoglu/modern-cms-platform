import { Injectable } from '@nestjs/common';
import type { SearchIndexEntityType } from '@prisma/client';
import type { GlobalSearchHitDto, PublicSearchHitDto } from './search.types';

type MallMeta = { id: string; slug: string; name: string } | null;

export interface IndexHitRow {
  id: string;
  entityType: SearchIndexEntityType;
  entityId: string;
  title: string;
  status: string;
  slug: string | null;
  score: number;
  mallId: string | null;
  tenantId: string | null;
  /** Enriched description (populated by PublicSearchService.enrichSearchHits) */
  description?: string | null;
  /** Enriched image URL (populated by PublicSearchService.enrichSearchHits) */
  imageUrl?: string | null;
}

const ENTITY_TYPE_LABEL: Partial<Record<SearchIndexEntityType, string>> = {
  PAGE: 'page',
  EVENT: 'event',
  CAMPAIGN: 'campaign',
  MALL_STORE: 'store',
  GLOBAL_STORE: 'store',
  MOVIE: 'movie',
  CINEMA: 'cinema',
  SLIDER: 'slider',
  LOCATION: 'location',
  POPUP: 'popup',
  SERVICE: 'service',
};

@Injectable()
export class SearchResultMapperService {
  toAdminHit(row: IndexHitRow, mall: MallMeta): GlobalSearchHitDto {
    return {
      id: row.entityId,
      title: row.title,
      entityType: row.entityType,
      status: row.status,
      score: Math.round(row.score * 1000) / 1000,
      url: this.adminUrl(row.entityType, row.entityId),
      slug: row.slug,
      mallId: row.mallId,
      mallSlug: mall?.slug ?? null,
      mallName: mall?.name ?? null,
      tenantId: row.tenantId,
    };
  }

  toPublicHit(row: IndexHitRow, localeCode: string | null = null): PublicSearchHitDto {
    return {
      type: ENTITY_TYPE_LABEL[row.entityType] ?? row.entityType.toLowerCase(),
      id: row.entityId,
      slug: row.slug,
      title: row.title,
      description: row.description ?? null,
      image: row.imageUrl ?? null,
      url: this.publicUrl(row),
      locale: localeCode,
    };
  }

  adminUrl(entityType: SearchIndexEntityType, id: string): string {
    const map: Record<SearchIndexEntityType, string> = {
      PAGE: `/pages/${id}`,
      EVENT: `/events?focus=${encodeURIComponent(id)}`,
      CAMPAIGN: `/campaigns?focus=${encodeURIComponent(id)}`,
      GLOBAL_STORE: `/global-stores?focus=${encodeURIComponent(id)}`,
      MALL_STORE: `/mall-stores?focus=${encodeURIComponent(id)}`,
      MOVIE: `/movies?focus=${encodeURIComponent(id)}`,
      CINEMA: `/cinemas?focus=${encodeURIComponent(id)}`,
      SLIDER: `/sliders?focus=${encodeURIComponent(id)}`,
      LOCATION: `/locations/${id}`,
      POPUP: `/popups?focus=${encodeURIComponent(id)}`,
      SERVICE: `/services?focus=${encodeURIComponent(id)}`,
    };
    return map[entityType];
  }

  /** Relative API path aligned with the /public/* HTTP surface. */
  publicUrl(row: IndexHitRow): string {
    const slug = row.slug ?? '';
    switch (row.entityType) {
      case 'PAGE':
        return `/public/pages/${encodeURIComponent(slug)}`;
      case 'EVENT':
        return `/public/events/${encodeURIComponent(slug)}`;
      case 'CAMPAIGN':
        return `/public/campaigns/${encodeURIComponent(slug)}`;
      case 'MALL_STORE':
        return `/public/stores/${encodeURIComponent(slug)}`;
      case 'MOVIE':
        return `/public/movie-sessions?movieId=${encodeURIComponent(row.entityId)}`;
      case 'CINEMA':
        return `/public/cinema`;
      case 'POPUP':
        return `/public/popups/${encodeURIComponent(row.entityId)}`;
      case 'SERVICE':
        return `/public/services/${encodeURIComponent(row.entityId)}`;
      default:
        return '/public';
    }
  }
}
