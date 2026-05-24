import type { MovieSessionStatus } from '@prisma/client';
import { MOVIE_SESSION_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMovieSessionsDto {
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
  @IsIn(MOVIE_SESSION_STATUSES)
  status?: MovieSessionStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cinemaId?: string;

  @IsOptional()
  @IsString()
  movieId?: string;

  @IsOptional()
  @IsDateString()
  startsFrom?: string;

  @IsOptional()
  @IsDateString()
  startsTo?: string;

  @IsOptional()
  @IsIn(['startsAt', 'createdAt'])
  sortBy?: 'startsAt' | 'createdAt' = 'startsAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'asc';
}
