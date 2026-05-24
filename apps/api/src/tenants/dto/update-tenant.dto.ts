import { IsOptional, IsString, IsIn } from 'class-validator';
import { TENANT_STATUSES } from '../../common/prisma-validation-enums.js';
import type { TenantStatus } from '@prisma/client';

export class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsString() billingEmail?: string;
  @IsOptional() addressJson?: unknown;
  @IsOptional() metadataJson?: unknown;
}

export class UpdateTenantStatusDto {
  @IsIn(TENANT_STATUSES) status!: TenantStatus;
}
