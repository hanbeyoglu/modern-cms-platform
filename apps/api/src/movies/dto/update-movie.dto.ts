import type { MovieStatus } from '@prisma/client';
import { MOVIE_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  originalTitle?: string;

  @IsOptional()
  @IsString()
  posterMediaId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : value !== undefined && value !== '' ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  durationMinutes?: number | null;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  rating?: string;

  @IsOptional()
  @IsString()
  trailerUrl?: string;

  @IsOptional()
  @IsString()
  ticketUrl?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string | null;

  @IsOptional()
  @IsDateString()
  publishStartAt?: string | null;

  @IsOptional()
  @IsDateString()
  publishEndAt?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : value !== undefined && value !== '' ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsIn(MOVIE_STATUSES)
  status?: MovieStatus;
}
