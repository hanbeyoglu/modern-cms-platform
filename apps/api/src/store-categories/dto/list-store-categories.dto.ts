import { IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';
import { STORE_CATEGORY_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { StoreCategoryStatus } from '@prisma/client';

export class ListStoreCategoriesDto {
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
  @IsIn(STORE_CATEGORY_STATUSES)
  status?: StoreCategoryStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
