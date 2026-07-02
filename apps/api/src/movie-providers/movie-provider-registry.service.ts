import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createTmdbProvider,
  DEFAULT_MOVIE_PROVIDERS_SETTINGS,
  resolveTmdbAccessToken,
  type MovieProvider,
  type MovieProviderConfig,
  type MovieProvidersSettings,
  type MovieProviderType,
  type TmdbProviderSettings,
} from '@modern-cms/movie-providers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MovieProviderRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private envTmdbToken(): string | undefined {
    return this.config.get<string>('TMDB_API_READ_ACCESS_TOKEN');
  }

  async getMovieProvidersSettings(tenantId: string): Promise<MovieProvidersSettings> {
    const row = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: 'movieProviders' } },
    });
    const stored = (row?.value ?? {}) as Partial<MovieProvidersSettings>;
    return {
      tmdb: { ...DEFAULT_MOVIE_PROVIDERS_SETTINGS.tmdb, ...(stored.tmdb ?? {}) },
    };
  }

  async resolveProvider(tenantId: string, type: MovieProviderType = 'TMDB'): Promise<MovieProvider> {
    if (type !== 'TMDB') {
      throw new UnprocessableEntityException(`Desteklenmeyen film sağlayıcısı: ${type}`);
    }
    const settings = await this.getMovieProvidersSettings(tenantId);
    const config = this.toTmdbConfig(settings.tmdb);
    if (!config.accessToken.trim()) {
      throw new UnprocessableEntityException(
        'TMDB Read Access Token yapılandırılmamış (tenant ayarı veya TMDB_API_READ_ACCESS_TOKEN)',
      );
    }
    return createTmdbProvider(config);
  }

  toTmdbConfig(settings: TmdbProviderSettings): MovieProviderConfig {
    return {
      accessToken: resolveTmdbAccessToken(settings.readAccessToken, this.envTmdbToken()),
      language: settings.language,
      region: settings.region,
      posterSize: settings.posterSize,
    };
  }
}
