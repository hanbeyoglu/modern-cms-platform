import { MovieSessionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  @IsEnum(MovieSessionStatus)
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
