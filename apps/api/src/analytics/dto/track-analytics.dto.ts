import { AnalyticsEntityType, AnalyticsEventType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class TrackAnalyticsDto {
  @IsEnum(AnalyticsEntityType)
  entityType!: AnalyticsEntityType;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  entityId?: string | null;

  @IsEnum(AnalyticsEventType)
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
  @IsObject()
  metadataJson?: Record<string, unknown> | null;
}
