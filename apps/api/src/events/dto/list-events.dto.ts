import { ContentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListEventsDto {
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
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['sortOrder', 'startAt', 'createdAt'])
  sortBy?: 'sortOrder' | 'startAt' | 'createdAt' = 'sortOrder';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsDateString()
  startFrom?: string;

  @IsOptional()
  @IsDateString()
  startTo?: string;

  @IsOptional()
  @IsDateString()
  endFrom?: string;

  @IsOptional()
  @IsDateString()
  endTo?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
