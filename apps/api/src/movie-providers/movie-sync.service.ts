import { Injectable } from '@nestjs/common';
import { runMovieSync } from '@modern-cms/movie-providers';
import { PrismaService } from '../prisma/prisma.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { MovieProviderRegistryService } from './movie-provider-registry.service';

@Injectable()
export class MovieSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: MovieProviderRegistryService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  async run(tenantId: string, systemUserId: string) {
    const settings = await this.registry.getMovieProvidersSettings(tenantId);
    if (!settings.tmdb.syncEnabled) {
      return {
        skipped: true,
        reason: 'TMDB sync devre dışı',
      };
    }

    const provider = await this.registry.resolveProvider(tenantId, 'TMDB');
    const result = await runMovieSync({
      prisma: this.prisma,
      provider,
      tenantId,
      systemUserId,
    });

    const syncedMovies = await this.prisma.movie.findMany({
      where: { tenantId, provider: 'TMDB', lastSyncedAt: { not: null } },
      select: { id: true },
      take: 500,
      orderBy: { lastSyncedAt: 'desc' },
    });
    for (const m of syncedMovies) {
      void this.searchIndexer.syncMovie(m.id).catch(() => undefined);
    }

    const currentRow = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'movieProviders' } },
    });
    const currentValue = (currentRow?.value ?? {}) as Record<string, unknown>;

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'movieProviders' } },
      update: {
        value: {
          ...currentValue,
          tmdb: {
            ...settings.tmdb,
            lastSync: {
              status: result.status,
              newMovies: result.newMovies,
              updatedMovies: result.updatedMovies,
              errors: result.failedMovies,
              finishedAt: new Date().toISOString(),
            },
          },
        },
      },
      create: {
        tenantId,
        key: 'movieProviders',
        value: {
          tmdb: {
            ...settings.tmdb,
            lastSync: {
              status: result.status,
              newMovies: result.newMovies,
              updatedMovies: result.updatedMovies,
              errors: result.failedMovies,
              finishedAt: new Date().toISOString(),
            },
          },
        },
      },
    });

    return result;
  }

  async resolveSystemUserId(tenantId: string): Promise<string> {
    const tu = await this.prisma.tenantUser.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (tu) return tu.userId;

    const superAdmin = await this.prisma.user.findFirst({
      where: { isSuperAdmin: true, deletedAt: null },
      select: { id: true },
    });
    if (superAdmin) return superAdmin.id;

    throw new Error('Senkronizasyon için sistem kullanıcısı bulunamadı');
  }
}
