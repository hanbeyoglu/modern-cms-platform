import type { MovieStatus, MovieListingStatus } from '@prisma/client';
import { MOVIE_STATUSES, MOVIE_LISTING_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMoviesDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(MOVIE_STATUSES)
  status?: MovieStatus;

  @IsOptional()
  @IsIn(MOVIE_LISTING_STATUSES)
  listingStatus?: MovieListingStatus;

  @IsOptional()
  @IsIn(['TMDB', 'MANUAL'])
  provider?: 'TMDB' | 'MANUAL';

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['sortOrder', 'title', 'createdAt', 'releaseDate'])
  sortBy?: 'sortOrder' | 'title' | 'createdAt' | 'releaseDate' = 'sortOrder';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsString()
  mallId?: string;
}
