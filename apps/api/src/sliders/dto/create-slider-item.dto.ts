import { IsInt, IsOptional, IsString, IsUrl, Min, ValidateIf, IsIn, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { SLIDER_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform, Type } from 'class-transformer';
import type { SliderStatus } from '@prisma/client';
import { SliderItemTranslationDto } from './slider-item-translation.dto.js';

export class CreateSliderItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o: CreateSliderItemDto) => !!o.linkUrl)
  @IsUrl({}, { message: 'linkUrl must be a valid URL' })
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  sameImageForAllLocales?: boolean;

  @IsOptional()
  @IsString()
  sharedImageId?: string;

  @IsOptional()
  @IsString()
  sharedMobileImageId?: string;

  /** @deprecated Use sharedImageId */
  @IsOptional()
  @IsString()
  desktopMediaId?: string;

  /** @deprecated Use sharedMobileImageId */
  @IsOptional()
  @IsString()
  mobileMediaId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SliderItemTranslationDto)
  translations?: SliderItemTranslationDto[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  desktopMediaWidthOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  desktopMediaHeightOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  mobileMediaWidthOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  mobileMediaHeightOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsIn(SLIDER_STATUSES)
  status?: SliderStatus = 'DRAFT';
}
