import type { Channel, ContentStatus } from '@prisma/client';
import { CHANNELS, CONTENT_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { CampaignTranslationDto } from './campaign-translation.dto.js';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  sameImageForAllLocales?: boolean;

  @IsOptional()
  @IsString()
  sharedCoverImageId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  coverMediaWidthOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  coverMediaHeightOverride?: number | null;

  @IsOptional()
  @IsDateString()
  publishStartAt?: string | null;

  @IsOptional()
  @IsDateString()
  publishEndAt?: string | null;

  @IsOptional()
  @IsDateString()
  campaignStartAt?: string | null;

  @IsOptional()
  @IsDateString()
  campaignEndAt?: string | null;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  storeId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(CONTENT_STATUSES)
  status?: ContentStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsObject()
  dynamicFieldsJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: Channel[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignTranslationDto)
  translations?: CampaignTranslationDto[];

  @IsOptional()
  @IsString()
  mallId?: string | null;
}
