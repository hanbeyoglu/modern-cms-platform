import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Channel, SliderLinkType, SliderStatus, SliderTargetDevice } from '@prisma/client';

export class UpdateSliderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  desktopMediaId?: string;

  @IsOptional()
  @IsString()
  mobileMediaId?: string;

  @IsOptional()
  @IsString()
  videoMediaId?: string;

  @IsOptional()
  @IsEnum(SliderLinkType)
  linkType?: SliderLinkType;

  @IsOptional()
  @IsString()
  linkValue?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(SliderStatus)
  status?: SliderStatus;

  @IsOptional()
  @IsEnum(SliderTargetDevice)
  targetDevice?: SliderTargetDevice;

  @IsOptional()
  @IsArray()
  @IsEnum(Channel, { each: true })
  channels?: Channel[];
}
