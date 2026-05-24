import type { MovieSessionStatus } from '@prisma/client';
import { MOVIE_SESSION_STATUSES } from '../../common/prisma-validation-enums.js';
import { IsDateString, IsOptional, IsString, MinLength, IsIn } from 'class-validator';

export class UpdateMovieSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  cinemaId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  movieId?: string;

  @IsOptional()
  @IsString()
  hallName?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  ticketUrl?: string;

  @IsOptional()
  @IsIn(MOVIE_SESSION_STATUSES)
  status?: MovieSessionStatus;
}
