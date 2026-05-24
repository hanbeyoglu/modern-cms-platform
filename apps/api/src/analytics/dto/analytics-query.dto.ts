import type { AnalyticsEntityType, AnalyticsEventType } from '@prisma/client';
import { ANALYTICS_ENTITY_TYPES, ANALYTICS_EVENT_TYPES } from '../../common/prisma-validation-enums.js';
import { Type } from 'class-transformer';
import { IsISO8601, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';

export class AnalyticsQueryDto {
  @IsISO8601()
  dateFrom!: string;

  @IsISO8601()
  dateTo!: string;

  @IsOptional()
  @IsIn(ANALYTICS_ENTITY_TYPES)
  entityType?: AnalyticsEntityType;

  @IsOptional()
  @IsIn(ANALYTICS_EVENT_TYPES)
  eventType?: AnalyticsEventType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
