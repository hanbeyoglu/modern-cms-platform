import type { PageStatus, PageType } from '@prisma/client';
import { PAGE_STATUSES, PAGE_TYPES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';

export class ListPagesDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value ? Number(value) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(PAGE_STATUSES)
  status?: PageStatus;

  @IsOptional()
  @IsIn(PAGE_TYPES)
  type?: PageType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'title'])
  sortBy?: 'createdAt' | 'updatedAt' | 'title';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
