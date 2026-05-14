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
}

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

  toPublicHit(row: IndexHitRow): PublicSearchHitDto {
    return {
      id: row.entityId,
      title: row.title,
      entityType: row.entityType,
      score: Math.round(row.score * 1000) / 1000,
      path: this.publicPath(row),
      slug: row.slug,
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
    };
    return map[entityType];
  }

  /** Relative paths aligned with existing `/public/*` HTTP surface. */
  publicPath(row: IndexHitRow): string {
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
      case 'SLIDER':
        return `/public/sliders`;
      default:
        return '/public';
    }
  }
}
