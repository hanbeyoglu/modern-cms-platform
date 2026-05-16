import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  Channel,
  SliderLinkedEntityType,
  SliderPlacementType,
  SliderStatus,
} from '@prisma/client';

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
  @IsEnum(SliderStatus)
  status?: SliderStatus;

  @IsOptional()
  @IsEnum(SliderPlacementType)
  placementType?: SliderPlacementType;

  @IsOptional()
  @IsEnum(SliderLinkedEntityType)
  linkedEntityType?: SliderLinkedEntityType;

  @IsOptional()
  @IsString()
  linkedEntityId?: string;

  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;

  @IsOptional()
  @IsString()
  search?: string;
}
