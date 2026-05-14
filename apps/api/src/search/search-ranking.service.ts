import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Ranking weights applied on top of PostgreSQL `ts_rank`.
 * Documented in docs/SPRINT15.md — keep multipliers conservative and predictable.
 */
@Injectable()
export class SearchRankingService {
  /** SQL expression: baseRank * statusBoost * featuredBoost * recencyBoost */
  rankSql(baseRank: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`(
      ${baseRank}
      * (CASE
          WHEN s."status" IN ('PUBLISHED', 'ACTIVE', 'LIVE', 'SCHEDULED') THEN 1.12
          WHEN s."status" IN ('DRAFT', 'PASSIVE', 'MAINTENANCE') THEN 0.92
          ELSE 1.0
        END)
      * (CASE WHEN s."isFeatured" = true THEN 1.06 ELSE 1.0 END)
      * (CASE
          WHEN s."publishedAt" IS NOT NULL THEN
            GREATEST(0.55, 1.0 - LEAST(1.0, EXTRACT(EPOCH FROM (NOW() - s."publishedAt")) / (86400.0 * 365.0)) * 0.35)
          ELSE 1.0
        END)
    )`;
  }

  /** Base ts_rank — title-heavy documents already include title first in `document`. */
  baseRankSql(tsQuery: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`ts_rank(to_tsvector('simple', s."document"), ${tsQuery})`;
  }
}
