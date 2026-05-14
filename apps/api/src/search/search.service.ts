import { Injectable } from '@nestjs/common';
import type { SearchIndexEntityType, User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { SEARCH_ENTITY_PERMISSION, type GlobalSearchResponseDto } from './search.types';
import type { IndexHitRow } from './search-result-mapper.service';
import { SearchResultMapperService } from './search-result-mapper.service';
import { SearchQueryBuilder } from './search-query-builder';
import { SearchRankingService } from './search-ranking.service';

const ALL_MALLS_ROLE_CODES = new Set(['TENANT_ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly queryBuilder: SearchQueryBuilder,
    private readonly ranking: SearchRankingService,
    private readonly mapper: SearchResultMapperService,
  ) {}

  async globalSearch(
    user: User,
    tenantId: string,
    q: string | undefined,
    limitPerGroup: number,
    headerMallId?: string | null,
  ): Promise<GlobalSearchResponseDto> {
    const empty: GlobalSearchResponseDto = {
      pages: [],
      events: [],
      campaigns: [],
      stores: [],
      movies: [],
      cinemas: [],
      sliders: [],
    };
    if (this.queryBuilder.isEmptyQuery(q)) return empty;

    const tsQuery = this.queryBuilder.prepareTsQuery(q!);
    const baseRank = this.ranking.baseRankSql(tsQuery);
    const scoreExpr = this.ranking.rankSql(baseRank);

    const mallScope = await this.resolveMallSqlScope(user, tenantId, headerMallId);

    const take = Math.min(Math.max(limitPerGroup, 1) * 12, 120);

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
      WHERE (
          s."tenantId" = ${tenantId}
          OR (s."entityType" = 'GLOBAL_STORE' AND s."tenantId" IS NULL)
        )
        AND (${mallScope})
        AND to_tsvector('simple', s."document") @@ ${tsQuery}
      ORDER BY "score" DESC
      LIMIT ${take}
    `,
    );

    const effective = await this.access.getEffectivePermissionCodes(user, tenantId);
    const filtered = rows.filter((r) => {
      const code = SEARCH_ENTITY_PERMISSION[r.entityType];
      return user.isSuperAdmin || effective.has(code);
    });

    const mallIds = [...new Set(filtered.map((r) => r.mallId).filter((id): id is string => !!id))];
    const malls =
      mallIds.length > 0
        ? await this.prisma.mall.findMany({
            where: { id: { in: mallIds }, tenantId },
            select: { id: true, slug: true, name: true },
          })
        : [];
    const mallMap = new Map(malls.map((m) => [m.id, m]));

    const buckets: GlobalSearchResponseDto = { ...empty };
    const perCap = Math.min(Math.max(limitPerGroup, 1), 20);

    for (const r of filtered) {
      const mall = r.mallId ? mallMap.get(r.mallId) ?? null : null;
      const hit = this.mapper.toAdminHit(r, mall);
      switch (r.entityType as SearchIndexEntityType) {
        case 'PAGE':
          if (buckets.pages.length < perCap) buckets.pages.push(hit);
          break;
        case 'EVENT':
          if (buckets.events.length < perCap) buckets.events.push(hit);
          break;
        case 'CAMPAIGN':
          if (buckets.campaigns.length < perCap) buckets.campaigns.push(hit);
          break;
        case 'GLOBAL_STORE':
        case 'MALL_STORE':
          if (buckets.stores.length < perCap) buckets.stores.push(hit);
          break;
        case 'MOVIE':
          if (buckets.movies.length < perCap) buckets.movies.push(hit);
          break;
        case 'CINEMA':
          if (buckets.cinemas.length < perCap) buckets.cinemas.push(hit);
          break;
        case 'SLIDER':
          if (buckets.sliders.length < perCap) buckets.sliders.push(hit);
          break;
        default:
          break;
      }
    }

    return buckets;
  }

  private async resolveMallSqlScope(
    user: User,
    tenantId: string,
    headerMallId?: string | null,
  ): Promise<Prisma.Sql> {
    if (user.isSuperAdmin) {
      return headerMallId
        ? Prisma.sql`(s."mallId" IS NULL OR s."mallId" = ${headerMallId} OR s."entityType" IN ('GLOBAL_STORE'::"SearchIndexEntityType", 'MOVIE'::"SearchIndexEntityType"))`
        : Prisma.sql`TRUE`;
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, tenantId, deletedAt: null },
      include: { role: true },
    });
    if (!tenantUser) {
      return Prisma.sql`FALSE`;
    }

    if (ALL_MALLS_ROLE_CODES.has(tenantUser.role.code)) {
      return headerMallId
        ? Prisma.sql`(s."mallId" IS NULL OR s."mallId" = ${headerMallId} OR s."entityType" IN ('GLOBAL_STORE'::"SearchIndexEntityType", 'MOVIE'::"SearchIndexEntityType"))`
        : Prisma.sql`TRUE`;
    }

    const accesses = await this.prisma.userMallAccess.findMany({
      where: { tenantUserId: tenantUser.id },
      select: { mallId: true },
    });
    const mallIds = accesses.map((a) => a.mallId);
    if (mallIds.length === 0) {
      return Prisma.sql`(s."mallId" IS NULL OR s."entityType" IN ('GLOBAL_STORE'::"SearchIndexEntityType", 'MOVIE'::"SearchIndexEntityType"))`;
    }

    const headerOk =
      headerMallId && mallIds.includes(headerMallId) ? headerMallId : null;

    if (headerOk) {
      return Prisma.sql`(s."mallId" IS NULL OR s."mallId" = ${headerOk} OR s."entityType" IN ('GLOBAL_STORE'::"SearchIndexEntityType", 'MOVIE'::"SearchIndexEntityType") OR s."mallId" IN (${Prisma.join(mallIds)}))`;
    }

    return Prisma.sql`(s."mallId" IS NULL OR s."entityType" IN ('GLOBAL_STORE'::"SearchIndexEntityType", 'MOVIE'::"SearchIndexEntityType") OR s."mallId" IN (${Prisma.join(mallIds)}))`;
  }
}
