import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { StoreStatus } from '@prisma/client';

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
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  websiteUrl?: string;

  @IsOptional()
  @IsObject()
  socialLinksJson?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(StoreStatus)
  status?: StoreStatus = StoreStatus.ACTIVE;
}
