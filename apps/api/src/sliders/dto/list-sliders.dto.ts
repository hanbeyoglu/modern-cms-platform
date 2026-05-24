import { IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { CHANNELS, SLIDER_STATUSES, SLIDER_PLACEMENT_TYPES, SLIDER_LINKED_ENTITY_TYPES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { Channel, SliderLinkedEntityType, SliderPlacementType, SliderStatus } from '@prisma/client';

export class ListSlidersDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 20))
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsIn(SLIDER_STATUSES)
  status?: SliderStatus;

  @IsOptional()
  @IsIn(SLIDER_PLACEMENT_TYPES)
  placementType?: SliderPlacementType;

  @IsOptional()
  @IsIn(SLIDER_LINKED_ENTITY_TYPES)
  linkedEntityType?: SliderLinkedEntityType;

  @IsOptional()
  @IsString()
  linkedEntityId?: string;

  @IsOptional()
  @IsIn(CHANNELS)
  channel?: Channel;

  @IsOptional()
  @IsString()
  search?: string;
}
