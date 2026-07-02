import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import type { TmdbProviderSettings } from '@modern-cms/movie-providers';

export class UpdateTmdbProviderSettingsDto implements Partial<TmdbProviderSettings> {
  @IsOptional()
  @IsString()
  readAccessToken?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  posterSize?: string;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  cronTime?: string;
}
