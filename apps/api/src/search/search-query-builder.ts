import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SearchNormalizerService } from './search-normalizer.service';

/**
 * Builds safe `plainto_tsquery` / filter SQL fragments for PostgreSQL FTS.
 * Keeps Prisma.sql composition in one place so SearchService stays thin
 * and future OpenSearch adapters can mirror the same intent API.
 */
@Injectable()
export class SearchQueryBuilder {
  constructor(private readonly normalizer: SearchNormalizerService) {}

  prepareTsQuery(q: string): Prisma.Sql {
    const n = this.normalizer.normalizeQuery(q);
    return Prisma.sql`plainto_tsquery('simple', ${n})`;
  }

  isEmptyQuery(q: string | undefined | null): boolean {
    return this.normalizer.normalizeQuery(q).length === 0;
  }
}
