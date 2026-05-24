import type { MovieSessionStatus } from '@prisma/client';
import { MOVIE_SESSION_STATUSES } from '../../common/prisma-validation-enums.js';
import { IsDateString, IsOptional, IsString, MinLength, IsIn } from 'class-validator';

export class CreateMovieSessionDto {
  @IsString()
  @MinLength(1)
  cinemaId!: string;

  @IsString()
  @MinLength(1)
  movieId!: string;

  @IsOptional()
  @IsString()
  hallName?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

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
