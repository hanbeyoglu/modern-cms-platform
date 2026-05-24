import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { MALL_STATUSES, LOCATION_TYPES } from '../../common/prisma-validation-enums.js';
import type { LocationType, MallStatus } from '@prisma/client';

export class UpdateLocationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsIn(LOCATION_TYPES) type?: LocationType;
  @IsOptional() @IsIn(MALL_STATUSES) status?: MallStatus;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logoMediaId?: string | null;
  @IsOptional() @IsString() coverMediaId?: string | null;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsString() supportEmail?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsNumber() latitude?: number | null;
  @IsOptional() @IsNumber() longitude?: number | null;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() workingHoursJson?: unknown;
  @IsOptional() socialLinksJson?: unknown;
  @IsOptional() metadataJson?: unknown;
  @IsOptional() @IsBoolean() isPublic?: boolean;
}
