import type { AnalyticsEntityType, AnalyticsEventType } from '@prisma/client';
import { ANALYTICS_ENTITY_TYPES, ANALYTICS_EVENT_TYPES } from '../../common/prisma-validation-enums.js';
import { IsObject, IsOptional, IsString, IsUrl, MaxLength, IsIn } from 'class-validator';

export class TrackAnalyticsDto {
  @IsIn(ANALYTICS_ENTITY_TYPES)
  entityType!: AnalyticsEntityType;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  entityId?: string | null;

  @IsIn(ANALYTICS_EVENT_TYPES)
  eventType!: AnalyticsEventType;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  path?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  referrer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string | null;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown> | null;
}
