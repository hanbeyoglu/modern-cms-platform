import { MovieSessionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

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
  @IsEnum(MovieSessionStatus)
  status?: MovieSessionStatus;
}
