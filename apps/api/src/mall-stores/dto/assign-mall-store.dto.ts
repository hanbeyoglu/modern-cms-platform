import { IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min, ValidateIf, IsIn } from 'class-validator';
import { STORE_STATUSES } from '../../common/prisma-validation-enums.js';
import { Transform } from 'class-transformer';
import type { StoreStatus } from '@prisma/client';

export class AssignMallStoreDto {
  @IsString()
  @IsNotEmpty()
  globalStoreId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  detailTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  localDescription?: string;

  @IsOptional()
  @IsString()
  localLogoMediaId?: string;

  @IsOptional()
  @IsString()
  floorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  storeNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsappPhone?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsObject()
  workingHoursJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  locationJson?: Record<string, unknown>;

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
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : 0))
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsIn(STORE_STATUSES)
  status?: StoreStatus = 'ACTIVE';

  @IsOptional()
  @IsString()
  categoryId?: string | null;
}
