import type { PageBlockStatus } from '@prisma/client';
import { PAGE_BLOCK_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, IsIn } from 'class-validator';

export class CreatePageBlockDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsObject()
  dataJson?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsIn(PAGE_BLOCK_STATUSES)
  status?: PageBlockStatus = 'ACTIVE';
}
