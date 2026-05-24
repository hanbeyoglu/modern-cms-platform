import { IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';
import { STORE_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { StoreStatus } from '@prisma/client';

export class ListGlobalStoresDto {
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
  @IsIn(STORE_STATUSES)
  status?: StoreStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
