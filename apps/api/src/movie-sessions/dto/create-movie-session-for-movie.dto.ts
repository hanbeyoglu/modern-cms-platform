import type { MovieSessionStatus } from '@prisma/client';
import { MOVIE_SESSION_STATUSES } from '../../common/prisma-validation-enums.js';
import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/**
 * Create a movie session for a specific movie (via /movies/:movieId/sessions).
 *
 * Business rules:
 * - showTime is the only required field ("HH:MM" format).
 * - showDate is optional ("YYYY-MM-DD"). When provided, startsAt is computed automatically.
 * - hallId references an existing ScreeningHall. hallName creates a new one on-the-fly.
 * - cinemaId is optional and kept for backward compatibility.
 * - endsAt is computed automatically from movie.durationMinutes when available.
 * - Users never enter an end time.
 */
export class CreateMovieSessionForMovieDto {
  /** Existing screening hall ID (optional). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  hallId?: string;

  /** Auto-create a new ScreeningHall with this name (e.g. "Salon 1", "VIP 2"). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  hallName?: string;

  /** Legacy: cinema operator reference. Optional. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  cinemaId?: string;

  /** Legacy: cinema operator name (auto-create if not found). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  cinemaName?: string;

  /** Screening time in HH:MM (24h) format. REQUIRED. */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'showTime must be in HH:MM format' })
  showTime!: string;

  /** Screening date in YYYY-MM-DD format. Optional. */
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
