import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SliderStatus } from '@prisma/client';

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
  @IsString()
  desktopMediaId?: string;

  @IsOptional()
  @IsString()
  mobileMediaId?: string;

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
  @IsEnum(SliderStatus)
  status?: SliderStatus = SliderStatus.DRAFT;
}
