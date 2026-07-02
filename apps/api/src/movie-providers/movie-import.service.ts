import { Injectable } from '@nestjs/common';
import { importMovieFromProvider } from '@modern-cms/movie-providers';
import { PrismaService } from '../prisma/prisma.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { AuditLogService } from '../audit/audit.service';
import { MovieProviderRegistryService } from './movie-provider-registry.service';

@Injectable()
export class MovieImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: MovieProviderRegistryService,
    private readonly searchIndexer: SearchIndexerService,
    private readonly audit: AuditLogService,
  ) {}

  async importFromTmdb(tenantId: string, userId: string, tmdbId: number) {
    const provider = await this.registry.resolveProvider(tenantId, 'TMDB');
    const result = await importMovieFromProvider(
      { prisma: this.prisma, provider, tenantId, userId },
      tmdbId,
    );

    void this.searchIndexer.syncMovie(result.movieId).catch(() => undefined);

    await this.audit.logAction({
      userId,
      tenantId,
      action: result.created ? 'movie:import' : 'movie:import-update',
      entityType: 'movie',
      entityId: result.movieId,
      after: { tmdbId: result.tmdbId, created: result.created },
    });

    const movie = await this.prisma.movie.findUniqueOrThrow({
      where: { id: result.movieId },
      include: {
        categories: { include: { category: true } },
      },
    });

    return { ...result, movie };
  }
}
