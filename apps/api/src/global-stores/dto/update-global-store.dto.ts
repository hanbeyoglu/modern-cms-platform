import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { STORE_STATUSES } from '../../common/prisma-validation-enums.js';
import type { StoreStatus } from '@prisma/client';
import { STORE_SOCIAL_PLATFORMS } from '../../common/types/store-social-link.js';

class StoreSocialLinkDto {
  @IsIn(STORE_SOCIAL_PLATFORMS)
  platform!: (typeof STORE_SOCIAL_PLATFORMS)[number];

  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  url!: string;
}

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreSocialLinkDto)
  @ArrayUnique((item: StoreSocialLinkDto) => item.platform === 'OTHER' ? `${item.platform}:${item.url}` : item.platform)
  socialLinks?: StoreSocialLinkDto[] | null;

  @IsOptional()
  @IsIn(STORE_STATUSES)
  status?: StoreStatus;
}
