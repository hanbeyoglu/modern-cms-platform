import { IsArray, IsDateString, IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { CHANNELS, SLIDER_STATUSES, SLIDER_PLACEMENT_TYPES, SLIDER_LINKED_ENTITY_TYPES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { Channel, SliderLinkedEntityType, SliderPlacementType, SliderStatus } from '@prisma/client';

export class UpdateSliderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(SLIDER_PLACEMENT_TYPES)
  placementType?: SliderPlacementType;

  @IsOptional()
  @IsIn(SLIDER_LINKED_ENTITY_TYPES)
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
  @IsIn(SLIDER_STATUSES)
  status?: SliderStatus;

  @IsOptional()
  @IsArray()
  @IsIn(CHANNELS, { each: true })
  channels?: Channel[];
}
