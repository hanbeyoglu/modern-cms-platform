import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { DEFAULT_MOVIE_PROVIDERS_SETTINGS, getTmdbAccessTokenSource } from '@modern-cms/movie-providers';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { UpdateTmdbProviderSettingsDto } from './dto/update-movie-providers-settings.dto';

@Injectable()
export class MovieProvidersSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  async getSettings(tenantId: string) {
    const row = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'movieProviders' } },
    });
    const stored = (row?.value ?? {}) as Record<string, unknown>;
    const tmdb = {
      ...DEFAULT_MOVIE_PROVIDERS_SETTINGS.tmdb,
      ...(stored.tmdb as Record<string, unknown> ?? {}),
    };
    const readAccessTokenSource = getTmdbAccessTokenSource(
      tmdb.readAccessToken as string | undefined,
      this.config.get<string>('TMDB_API_READ_ACCESS_TOKEN'),
    );
    return {
      tenantId,
      movieProviders: {
        tmdb: {
          ...tmdb,
          readAccessTokenSource,
          readAccessTokenConfigured: readAccessTokenSource !== 'none',
        },
      },
    };
  }

  async updateTmdbSettings(actor: User, tenantId: string, dto: UpdateTmdbProviderSettingsDto) {
    await this.assertAccess(actor, tenantId);
    const current = await this.getSettings(tenantId);
    const nextTmdb = { ...current.movieProviders.tmdb, ...dto };

    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: 'movieProviders' } },
      update: { value: { tmdb: nextTmdb } },
      create: { tenantId, key: 'movieProviders', value: { tmdb: nextTmdb } },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId,
      action: 'settings_updated',
      entityType: 'tenant_setting',
      entityId: tenantId,
      after: { movieProviders: { tmdb: { ...nextTmdb, readAccessToken: nextTmdb.readAccessToken ? '***' : '' } } },
    });

    return this.getSettings(tenantId);
  }

  private async assertAccess(actor: User, tenantId: string): Promise<void> {
    if (actor.isSuperAdmin) {
      const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
      if (!tenant) throw new NotFoundException('Tenant bulunamadı');
      return;
    }
    const tu = await this.prisma.tenantUser.findFirst({
      where: { userId: actor.id, tenantId, deletedAt: null },
    });
    if (!tu) throw new ForbiddenException('Bu tenant için erişim yok');
  }
}
