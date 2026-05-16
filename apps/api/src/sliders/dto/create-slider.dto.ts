import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
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

export class CreateSliderDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsEnum(SliderPlacementType)
  placementType?: SliderPlacementType = SliderPlacementType.HOME;

  @IsOptional()
  @IsEnum(SliderLinkedEntityType)
  linkedEntityType?: SliderLinkedEntityType;

  @IsOptional()
  @IsString()
  linkedEntityId?: string;

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
  @IsArray()
  @IsEnum(Channel, { each: true })
  channels?: Channel[];
}
