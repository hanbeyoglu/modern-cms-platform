import { IsInt, IsOptional, IsString, MaxLength, Min, IsIn } from 'class-validator';
import { STORE_CATEGORY_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { StoreCategoryStatus } from '@prisma/client';

export class UpdateStoreCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined && value !== null ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(STORE_CATEGORY_STATUSES)
  status?: StoreCategoryStatus;
}
