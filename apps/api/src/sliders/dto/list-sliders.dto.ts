import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { SliderStatus, SliderTargetDevice } from '@prisma/client';

export class ListSlidersDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SliderStatus)
  status?: SliderStatus;

  @IsOptional()
  @IsEnum(SliderTargetDevice)
  targetDevice?: SliderTargetDevice;

  @IsOptional()
  @IsString()
  search?: string;
}
