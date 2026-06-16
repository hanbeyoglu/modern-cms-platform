import { IsInt, IsOptional, IsString, IsUrl, Min, ValidateIf, IsIn, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { SLIDER_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform, Type } from 'class-transformer';
import type { SliderStatus } from '@prisma/client';
import { SliderItemTranslationDto } from './slider-item-translation.dto.js';

export class UpdateSliderItemDto {
  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  buttonText?: string | null;

  @IsOptional()
  @IsString()
  @ValidateIf((o: UpdateSliderItemDto) => !!o.linkUrl)
  @IsUrl({}, { message: 'linkUrl must be a valid URL' })
  linkUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  sameImageForAllLocales?: boolean;

  @IsOptional()
  @IsString()
  sharedImageId?: string | null;

  @IsOptional()
  @IsString()
  sharedMobileImageId?: string | null;

  /** @deprecated Use sharedImageId */
  @IsOptional()
  @IsString()
  desktopMediaId?: string | null;

  /** @deprecated Use sharedMobileImageId */
  @IsOptional()
  @IsString()
  mobileMediaId?: string | null;

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
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(SLIDER_STATUSES)
  status?: SliderStatus;
}
