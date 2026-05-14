import { Injectable } from '@nestjs/common';
import type { LocalizedEntityType, SearchIndexEntityType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationResolverService } from '../translation-resolver/translation-resolver.service';
import type { PublicSearchResponseDto } from './search.types';
import type { IndexHitRow } from './search-result-mapper.service';
import { SearchResultMapperService } from './search-result-mapper.service';
import { SearchQueryBuilder } from './search-query-builder';
import { SearchRankingService } from './search-ranking.service';

const PUBLIC_ENTITY_TYPES: SearchIndexEntityType[] = [
  'PAGE',
  'EVENT',
  'CAMPAIGN',
  'MALL_STORE',
  'MOVIE',
  'CINEMA',
];

function toLocalizedType(t: SearchIndexEntityType): LocalizedEntityType | null {
  const m: Partial<Record<SearchIndexEntityType, LocalizedEntityType>> = {
    PAGE: 'PAGE',
    EVENT: 'EVENT',
    CAMPAIGN: 'CAMPAIGN',
    MALL_STORE: 'STORE',
    MOVIE: 'MOVIE',
    CINEMA: 'CINEMA',
  };
  return m[t] ?? null;
}

@Injectable()
export class PublicSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBuilder: SearchQueryBuilder,
    private readonly ranking: SearchRankingService,
    private readonly mapper: SearchResultMapperService,
    private readonly translations: TranslationResolverService,
  ) {}

  async search(opts: {
    tenantId: string;
    mallId?: string | null;
    q: string | undefined;
    type?: string;
    limit: number;
    localeId?: string | null;
  }): Promise<PublicSearchResponseDto> {
    if (this.queryBuilder.isEmptyQuery(opts.q)) {
      return { results: [] };
    }

    const tsQuery = this.queryBuilder.prepareTsQuery(opts.q!);
    const baseRank = this.ranking.baseRankSql(tsQuery);
    const scoreExpr = this.ranking.rankSql(baseRank);

    const typeFilter =
      opts.type && PUBLIC_ENTITY_TYPES.includes(opts.type as SearchIndexEntityType)
        ? Prisma.sql`s."entityType" = ${opts.type}::"SearchIndexEntityType"`
        : Prisma.sql`s."entityType" IN (
            'PAGE'::"SearchIndexEntityType",
            'EVENT'::"SearchIndexEntityType",
            'CAMPAIGN'::"SearchIndexEntityType",
            'MALL_STORE'::"SearchIndexEntityType",
            'MOVIE'::"SearchIndexEntityType",
            'CINEMA'::"SearchIndexEntityType"
          )`;

    const mallClause =
      opts.mallId != null && opts.mallId !== ''
        ? Prisma.sql`(s."entityType" = 'MOVIE'::"SearchIndexEntityType" OR s."mallId" IS NULL OR s."mallId" = ${opts.mallId})`
        : Prisma.sql`(s."mallId" IS NULL OR s."entityType" = 'MOVIE'::"SearchIndexEntityType")`;

    const take = Math.min(Math.max(opts.limit, 1), 50);

    const rows = await this.prisma.$queryRaw<IndexHitRow[]>(
      Prisma.sql`
      SELECT
        s."id",
        s."entityType",
        s."entityId",
        s."title",
        s."status",
        s."slug",
        (${scoreExpr})::float AS "score",
        s."mallId",
        s."tenantId"
      FROM "SearchIndexEntry" s
      WHERE s."tenantId" = ${opts.tenantId}
        AND (${typeFilter})
        AND (${mallClause})
        AND to_tsvector('simple', s."document") @@ ${tsQuery}
      ORDER BY "score" DESC
      LIMIT ${take * 3}
    `,
    );

    const now = new Date();
    const visible = await this.filterPublished(rows, opts.tenantId, opts.mallId ?? null, now);
    const trimmed = visible.slice(0, take);
    const titled = await this.applyLocaleTitles(opts.tenantId, opts.localeId ?? null, trimmed);
    return { results: titled.map((r) => this.mapper.toPublicHit(r)) };
  }

  private async filterPublished(
    rows: IndexHitRow[],
    tenantId: string,
    mallId: string | null,
    now: Date,
  ): Promise<IndexHitRow[]> {
    const byType = new Map<SearchIndexEntityType, string[]>();
    for (const r of rows) {
      const list = byType.get(r.entityType) ?? [];
      list.push(r.entityId);
      byType.set(r.entityType, list);
    }

    const allowed = new Set<string>();
    const mallScope = mallId
      ? { OR: [{ mallId }, { mallId: null }] }
      : { OR: [{ mallId: null }] };

    const [pages, events, campaigns, stores, movies, cinemas] = await Promise.all([
      byType.get('PAGE')?.length
        ? this.prisma.page.findMany({
            where: {
              id: { in: byType.get('PAGE') },
              tenantId,
              deletedAt: null,
              status: 'PUBLISHED',
              ...mallScope,
              AND: [
                { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
                { OR: [{ unpublishAt: null }, { unpublishAt: { gte: now } }] },
              ],
            },
            select: { id: true },
          })
        : [],
      byType.get('EVENT')?.length
        ? this.prisma.event.findMany({
            where: {
              id: { in: byType.get('EVENT') },
              tenantId,
              deletedAt: null,
              status: 'PUBLISHED',
              ...mallScope,
              AND: [
                { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                { OR: [{ endAt: null }, { endAt: { gte: now } }] },
              ],
            },
            select: { id: true },
          })
        : [],
      byType.get('CAMPAIGN')?.length
        ? this.prisma.campaign.findMany({
            where: {
              id: { in: byType.get('CAMPAIGN') },
              tenantId,
              deletedAt: null,
              status: 'PUBLISHED',
              ...mallScope,
              AND: [
                { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                { OR: [{ endAt: null }, { endAt: { gte: now } }] },
              ],
            },
            select: { id: true },
          })
        : [],
      byType.get('MALL_STORE')?.length && mallId
        ? this.prisma.mallStore.findMany({
            where: {
              id: { in: byType.get('MALL_STORE') },
              tenantId,
              mallId,
              deletedAt: null,
              status: 'ACTIVE',
              globalStore: { deletedAt: null, status: 'ACTIVE' },
            },
            select: { id: true },
          })
        : [],
      byType.get('MOVIE')?.length
        ? this.prisma.movie.findMany({
            where: {
              id: { in: byType.get('MOVIE') },
              tenantId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            select: { id: true },
          })
        : [],
      byType.get('CINEMA')?.length && mallId
        ? this.prisma.cinema.findMany({
            where: {
              id: { in: byType.get('CINEMA') },
              tenantId,
              mallId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            select: { id: true },
          })
        : [],
    ]);

    for (const p of pages) allowed.add(`PAGE:${p.id}`);
    for (const e of events) allowed.add(`EVENT:${e.id}`);
    for (const c of campaigns) allowed.add(`CAMPAIGN:${c.id}`);
    for (const s of stores) allowed.add(`MALL_STORE:${s.id}`);
    for (const m of movies) allowed.add(`MOVIE:${m.id}`);
    for (const c of cinemas) allowed.add(`CINEMA:${c.id}`);

    return rows.filter((r) => allowed.has(`${r.entityType}:${r.entityId}`));
  }

  private async applyLocaleTitles(
    tenantId: string,
    localeId: string | null,
    rows: IndexHitRow[],
  ): Promise<IndexHitRow[]> {
    if (!localeId || rows.length === 0) return rows;

    const byLoc = new Map<LocalizedEntityType, string[]>();
    for (const r of rows) {
      const lt = toLocalizedType(r.entityType);
      if (!lt) continue;
      const arr = byLoc.get(lt) ?? [];
      arr.push(r.entityId);
      byLoc.set(lt, arr);
    }

    const maps = new Map<string, string>();
    for (const [lt, ids] of byLoc) {
      if (ids.length === 0) continue;
      const tmap = await this.translations.getTranslationsForEntities(tenantId, localeId, lt, ids);
      for (const id of ids) {
        const tr = tmap[id];
        const title = tr?.['title'] ?? tr?.['name'];
        if (title) maps.set(`${lt}:${id}`, title);
      }
    }

    return rows.map((r) => {
      const lt = toLocalizedType(r.entityType);
      if (!lt) return r;
      const title = maps.get(`${lt}:${r.entityId}`);
      if (!title) return r;
      return { ...r, title };
    });
  }
}
