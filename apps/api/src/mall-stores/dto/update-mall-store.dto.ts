import { IsArray, IsBoolean, IsEmail, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateIf, IsIn } from 'class-validator';
import { STORE_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { StoreStatus } from '@prisma/client';

export class UpdateMallStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  detailTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  localDescription?: string | null;

  @IsOptional()
  @IsString()
  localLogoMediaId?: string | null;

  @IsOptional()
  @IsString()
  floorId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  storeNo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsappPhone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsObject()
  workingHoursJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  locationJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isSoon?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchTags?: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined && value !== null ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(STORE_STATUSES)
  status?: StoreStatus;

  @IsOptional()
  @IsString()
  categoryId?: string | null;
}
