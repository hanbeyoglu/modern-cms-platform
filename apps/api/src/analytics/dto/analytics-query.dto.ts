import { AnalyticsEntityType, AnalyticsEventType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsInt, Min, Max } from 'class-validator';

export class AnalyticsQueryDto {
  @IsISO8601()
  dateFrom!: string;

  @IsISO8601()
  dateTo!: string;

  @IsOptional()
  @IsEnum(AnalyticsEntityType)
  entityType?: AnalyticsEntityType;

  @IsOptional()
  @IsEnum(AnalyticsEventType)
  eventType?: AnalyticsEventType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
