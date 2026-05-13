import { MovieStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
  @IsDateString()
  releaseDate?: string | null;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;
}
