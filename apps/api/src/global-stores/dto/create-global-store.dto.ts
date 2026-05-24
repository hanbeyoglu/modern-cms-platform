import { IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MaxLength, IsIn } from 'class-validator';
import { STORE_STATUSES } from '../../common/prisma-validation-enums.js';
import type { StoreStatus } from '@prisma/client';

export class CreateGlobalStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  logoMediaId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  websiteUrl?: string;

  @IsOptional()
  @IsObject()
  socialLinksJson?: Record<string, unknown>;

  @IsOptional()
  @IsIn(STORE_STATUSES)
  status?: StoreStatus = 'ACTIVE';
}
