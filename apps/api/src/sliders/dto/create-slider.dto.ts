import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SliderLinkType, SliderStatus, SliderTargetDevice } from '@prisma/client';

export class CreateSliderDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

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
  linkType?: SliderLinkType = SliderLinkType.NONE;

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
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsEnum(SliderStatus)
  status?: SliderStatus = SliderStatus.DRAFT;

  @IsOptional()
  @IsEnum(SliderTargetDevice)
  targetDevice?: SliderTargetDevice = SliderTargetDevice.ALL;
}
