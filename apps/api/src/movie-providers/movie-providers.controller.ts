import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { tmdbImage } from '@modern-cms/movie-providers';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';
import { MovieProviderRegistryService } from './movie-provider-registry.service';
import { MovieImportService } from './movie-import.service';
import { MovieSyncQueueService } from './movie-sync-queue.service';
import { MovieImportQueueService } from './movie-import-queue.service';
import { TmdbBrowseDto, TmdbImportDto, TmdbSearchDto } from './dto/tmdb.dto';
import { TmdbBulkImportDto } from './dto/tmdb-bulk-import.dto';
import { UpdateTmdbProviderSettingsDto } from './dto/update-movie-providers-settings.dto';
import { MovieProvidersSettingsService } from './movie-providers-settings.service';

function enrichListItem(
  item: {
    id: number;
    title: string;
    originalTitle?: string;
    releaseDate?: string;
    posterPath?: string | null;
    voteAverage?: number;
    genreNames?: string[];
  },
  posterSize: string,
  importStatus: 'import' | 'update' | null,
) {
  return {
    tmdbId: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    releaseDate: item.releaseDate,
    genres: item.genreNames ?? [],
    tmdbVoteAverage: item.voteAverage,
    posterUrl: tmdbImage(item.posterPath, posterSize),
    importStatus,
  };
}

@ApiTags(SWAGGER_TAGS.MOVIE_PROVIDERS)
@ApiAdminContext()
@Controller()
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class MovieProvidersController {
  constructor(
    private readonly registry: MovieProviderRegistryService,
    private readonly importService: MovieImportService,
    private readonly syncQueue: MovieSyncQueueService,
    private readonly importQueue: MovieImportQueueService,
    private readonly settings: MovieProvidersSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('movie-providers/settings')
  @RequirePermission('settings:read')
  @ApiAdminOperation({
    summary: 'movieProviders.settings.get.summary',
    permissions: ['settings:read'],
    related: [SWAGGER_TAGS.SETTINGS],
  })
  @ApiResponse({ status: 200, description: 'movieProviders.response.200' })
  getSettings(@Req() req: Request) {
    return this.settings.getSettings(req.tenantId!);
  }

  @Patch('movie-providers/settings/tmdb')
  @RequirePermission('settings:update')
  @ApiAdminOperation({
    summary: 'movieProviders.settings.update.summary',
    permissions: ['settings:update'],
    related: [SWAGGER_TAGS.SETTINGS],
  })
  @ApiResponse({ status: 200, description: 'movieProviders.response.200' })
  updateTmdbSettings(
    @CurrentUser() actor: User,
    @Req() req: Request,
    @Body() dto: UpdateTmdbProviderSettingsDto,
  ) {
    return this.settings.updateTmdbSettings(actor, req.tenantId!, dto);
  }

  @Get('movie-providers/tmdb/now-playing')
  @RequirePermission('movie:read')
  @ApiAdminOperation({
    summary: 'movieProviders.tmdb.nowPlaying.summary',
    permissions: ['movie:read'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  async nowPlaying(@Req() req: Request, @Query() query: TmdbBrowseDto) {
    return this.browseList(req.tenantId!, (p, provider) => provider.getNowPlaying(p), query.page);
  }

  @Get('movie-providers/tmdb/upcoming')
  @RequirePermission('movie:read')
  @ApiAdminOperation({
    summary: 'movieProviders.tmdb.upcoming.summary',
    permissions: ['movie:read'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  async upcoming(@Req() req: Request, @Query() query: TmdbBrowseDto) {
    return this.browseList(req.tenantId!, (p, provider) => provider.getUpcoming(p), query.page);
  }

  @Get('movie-providers/tmdb/popular')
  @RequirePermission('movie:read')
  @ApiAdminOperation({
    summary: 'movieProviders.tmdb.popular.summary',
    permissions: ['movie:read'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  async popular(@Req() req: Request, @Query() query: TmdbBrowseDto) {
    return this.browseList(req.tenantId!, (p, provider) => provider.getPopular(p), query.page);
  }

  @Get('movie-providers/tmdb/search')
  @RequirePermission('movie:read')
  @ApiAdminOperation({
    summary: 'movieProviders.tmdb.search.summary',
    permissions: ['movie:read'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  async search(@Req() req: Request, @Query() query: TmdbSearchDto) {
    const settings = await this.registry.getMovieProvidersSettings(req.tenantId!);
    const provider = await this.registry.resolveProvider(req.tenantId!, 'TMDB');
    const page = query.page ?? 1;
    const data = await provider.searchMovies(query.q, page);
    const importMap = await this.importStatusMap(
      req.tenantId!,
      data.results.map((r) => r.id),
    );
    return {
      page: data.page,
      totalPages: data.totalPages,
      totalResults: data.totalResults,
      results: data.results.map((item) =>
        enrichListItem(item, settings.tmdb.posterSize, importMap.get(item.id) ?? 'import'),
      ),
    };
  }

  @Post('movie-providers/tmdb/import')
  @RequirePermission('movie:create')
  @ApiAdminOperation({
    summary: 'movieProviders.tmdb.import.summary',
    permissions: ['movie:create'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  @ApiResponse({ status: 201, description: 'movieProviders.import.201' })
  importMovie(@CurrentUser() user: User, @Req() req: Request, @Body() dto: TmdbImportDto) {
    return this.importService.importFromTmdb(req.tenantId!, user.id, dto.tmdbId);
  }

  @Post('movie-providers/tmdb/import/bulk')
  @HttpCode(202)
  @RequirePermission('movie:create')
  @ApiAdminOperation({
    summary: 'movieProviders.tmdb.importBulk.summary',
    description: 'movieProviders.tmdb.importBulk.description',
    permissions: ['movie:create'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  @ApiResponse({ status: 202, description: 'movieProviders.importBulk.202' })
  async importBulk(@CurrentUser() user: User, @Req() req: Request, @Body() dto: TmdbBulkImportDto) {
    const tenantId = req.tenantId!;
    const uniqueIds = [...new Set(dto.tmdbIds)];
    const importMap = await this.importStatusMap(tenantId, uniqueIds);
    const preview = {
      total: uniqueIds.length,
      newMovies: uniqueIds.filter((id) => importMap.get(id) === 'import').length,
      updatedMovies: uniqueIds.filter((id) => importMap.get(id) === 'update').length,
    };
    const { batchId, jobId } = await this.importQueue.enqueueBulkImport({
      tenantId,
      userId: user.id,
      provider: 'TMDB',
      tmdbIds: uniqueIds,
    });
    return { accepted: true, batchId, jobId, preview };
  }

  @Get('movie-providers/import/batches/:batchId')
  @RequirePermission('movie:read')
  @ApiUuidParam('batchId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'movieProviders.import.batchProgress.summary',
    description: 'movieProviders.import.batchProgress.description',
    permissions: ['movie:read'],
  })
  @ApiResponse({ status: 200, description: 'movieProviders.response.200' })
  async importBatchProgress(@Param('batchId') batchId: string, @Req() req: Request) {
    const progress = await this.importQueue.getProgress(batchId, req.tenantId!);
    if (!progress) {
      return { found: false };
    }
    return { found: true, progress };
  }

  @Post('movie-providers/sync')
  @HttpCode(202)
  @RequirePermission('movie:update')
  @ApiAdminOperation({
    summary: 'movieProviders.sync.summary',
    permissions: ['movie:update'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  @ApiResponse({ status: 202, description: 'movieProviders.sync.202' })
  async triggerSync(@CurrentUser() user: User, @Req() req: Request) {
    const jobId = await this.syncQueue.enqueueSync({
      tenantId: req.tenantId!,
      provider: 'TMDB',
      triggeredBy: 'manual',
      userId: user.id,
    });
    return { accepted: true, jobId };
  }

  @Get('movie-providers/sync/logs')
  @RequirePermission('movie:read')
  @ApiAdminOperation({
    summary: 'movieProviders.sync.logs.summary',
    permissions: ['movie:read'],
  })
  async syncLogs(@Req() req: Request) {
    const logs = await this.prisma.movieSyncLog.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return { logs };
  }

  @Post('movies/:id/sync-from-provider')
  @RequirePermission('movie:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'movieProviders.movie.resync.summary',
    permissions: ['movie:update'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  async resyncMovie(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    const movie = await this.prisma.movie.findFirst({
      where: { id, tenantId: req.tenantId!, deletedAt: null },
    });
    if (!movie?.tmdbId) {
      return { error: 'Film TMDB kaynağına bağlı değil' };
    }
    return this.importService.importFromTmdb(req.tenantId!, user.id, movie.tmdbId);
  }

  private async browseList(
    tenantId: string,
    fetch: (page: number, provider: Awaited<ReturnType<MovieProviderRegistryService['resolveProvider']>>) => ReturnType<Awaited<ReturnType<MovieProviderRegistryService['resolveProvider']>>['getNowPlaying']>,
    page = 1,
  ) {
    const settings = await this.registry.getMovieProvidersSettings(tenantId);
    const provider = await this.registry.resolveProvider(tenantId, 'TMDB');
    const data = await fetch(page ?? 1, provider);
    const importMap = await this.importStatusMap(
      tenantId,
      data.results.map((r) => r.id),
    );
    return {
      page: data.page,
      totalPages: data.totalPages,
      totalResults: data.totalResults,
      results: data.results.map((item) =>
        enrichListItem(item, settings.tmdb.posterSize, importMap.get(item.id) ?? 'import'),
      ),
    };
  }

  private async importStatusMap(tenantId: string, tmdbIds: number[]) {
    if (tmdbIds.length === 0) return new Map<number, 'import' | 'update'>();
    const rows = await this.prisma.movie.findMany({
      where: { tenantId, tmdbId: { in: tmdbIds }, deletedAt: null },
      select: { tmdbId: true },
    });
    const map = new Map<number, 'import' | 'update'>();
    for (const id of tmdbIds) {
      map.set(id, rows.some((r) => r.tmdbId === id) ? 'update' : 'import');
    }
    return map;
  }
}
