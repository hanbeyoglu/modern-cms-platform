import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { LOCATION_TYPES } from '../../common/prisma-validation-enums.js';
import type { LocationType } from '@prisma/client';

export class CreateLocationDto {
  @IsString() name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsIn(LOCATION_TYPES) type?: LocationType;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logoMediaId?: string;
  @IsOptional() @IsString() coverMediaId?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsString() supportEmail?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() workingHoursJson?: unknown;
  @IsOptional() socialLinksJson?: unknown;
  @IsOptional() metadataJson?: unknown;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsString() tenantId?: string;
}
