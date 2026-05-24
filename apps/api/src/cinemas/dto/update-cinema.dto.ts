import type { CinemaProviderType, CinemaStatus } from '@prisma/client';
import { CINEMA_STATUSES, CINEMA_PROVIDER_TYPES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength, IsIn } from 'class-validator';

export class UpdateCinemaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  logoMediaId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CINEMA_PROVIDER_TYPES)
  providerType?: CinemaProviderType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return value;
      }
    }
    return value as Record<string, unknown> | null;
  })
  providerConfigJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsIn(CINEMA_STATUSES)
  status?: CinemaStatus;
}
