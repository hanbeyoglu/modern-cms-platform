import type { MovieSessionStatus } from '@prisma/client';
import { MOVIE_SESSION_STATUSES } from '../../common/prisma-validation-enums.js';
import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateMovieSessionForMovieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  hallId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  hallName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cinemaId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  cinemaName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'showTime must be in HH:MM format' })
  showTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'showDate must be in YYYY-MM-DD format' })
  showDate?: string;

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
