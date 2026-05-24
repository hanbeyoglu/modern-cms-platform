import { IsObject, IsOptional, IsString, IsUrl, MaxLength, IsIn } from 'class-validator';
import { STORE_STATUSES } from '../../common/prisma-validation-enums.js';
import type { StoreStatus } from '@prisma/client';

export class UpdateGlobalStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  logoMediaId?: string | null;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  websiteUrl?: string | null;

  @IsOptional()
  @IsObject()
  socialLinksJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsIn(STORE_STATUSES)
  status?: StoreStatus;
}
