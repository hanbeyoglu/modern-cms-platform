import { IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { CHANNELS, SLIDER_STATUSES, SLIDER_PLACEMENT_TYPES, SLIDER_LINKED_ENTITY_TYPES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { Channel, SliderLinkedEntityType, SliderPlacementType, SliderStatus } from '@prisma/client';

export class CreateSliderDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsIn(SLIDER_PLACEMENT_TYPES)
  placementType?: SliderPlacementType = 'HOME';

  @IsOptional()
  @IsIn(SLIDER_LINKED_ENTITY_TYPES)
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
  @IsIn(SLIDER_STATUSES)
  status?: SliderStatus = 'DRAFT';

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: Channel[];
}
