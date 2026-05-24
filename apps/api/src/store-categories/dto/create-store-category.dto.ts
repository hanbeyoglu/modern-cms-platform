import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, IsIn } from 'class-validator';
import { STORE_CATEGORY_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { StoreCategoryStatus } from '@prisma/client';

export class CreateStoreCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsIn(STORE_CATEGORY_STATUSES)
  status?: StoreCategoryStatus = 'ACTIVE';
}
