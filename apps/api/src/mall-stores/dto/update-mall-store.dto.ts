import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { StoreStatus } from '@prisma/client';

export class UpdateMallStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  localName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  localDescription?: string | null;

  @IsOptional()
  @IsString()
  localLogoMediaId?: string | null;

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
  @IsEnum(StoreStatus)
  status?: StoreStatus;
}
