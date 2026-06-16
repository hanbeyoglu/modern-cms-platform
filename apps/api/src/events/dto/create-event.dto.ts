import type { Channel, ContentStatus } from '@prisma/client';
import { CHANNELS, CONTENT_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { EventTranslationDto } from './event-translation.dto.js';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

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
  sharedCoverImageId?: string;

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
  publishStartAt?: string;

  @IsOptional()
  @IsDateString()
  publishEndAt?: string;

  @IsOptional()
  @IsDateString()
  eventStartAt?: string;

  @IsOptional()
  @IsDateString()
  eventEndAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsIn(CONTENT_STATUSES)
  status?: ContentStatus = 'DRAFT';

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: Channel[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventTranslationDto)
  translations?: EventTranslationDto[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
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
  dynamicFieldsJson?: Record<string, unknown>;
}
