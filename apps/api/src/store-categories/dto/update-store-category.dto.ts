import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { StoreCategoryStatus } from '@prisma/client';

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
  @IsEnum(StoreCategoryStatus)
  status?: StoreCategoryStatus;
}
