import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { StoreStatus } from '@prisma/client';

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
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  websiteUrl?: string | null;

  @IsOptional()
  @IsObject()
  socialLinksJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsEnum(StoreStatus)
  status?: StoreStatus;
}
