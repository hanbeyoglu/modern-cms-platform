import { MovieSessionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

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
  @IsEnum(MovieSessionStatus)
  status?: MovieSessionStatus;
}
