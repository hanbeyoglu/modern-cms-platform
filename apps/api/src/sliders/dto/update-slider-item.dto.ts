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
  @IsString()
  desktopMediaId?: string | null;

  @IsOptional()
  @IsString()
  mobileMediaId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(SliderStatus)
  status?: SliderStatus;
}
