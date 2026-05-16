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
import {
  Channel,
  SliderLinkedEntityType,
  SliderPlacementType,
  SliderStatus,
} from '@prisma/client';

export class UpdateSliderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(SliderPlacementType)
  placementType?: SliderPlacementType;

  @IsOptional()
  @IsEnum(SliderLinkedEntityType)
  linkedEntityType?: SliderLinkedEntityType | null;

  @IsOptional()
  @IsString()
  linkedEntityId?: string | null;

  @IsOptional()
  @IsDateString()
  startAt?: string | null;

  @IsOptional()
  @IsDateString()
  endAt?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(SliderStatus)
  status?: SliderStatus;

  @IsOptional()
  @IsArray()
  @IsEnum(Channel, { each: true })
  channels?: Channel[];
}
