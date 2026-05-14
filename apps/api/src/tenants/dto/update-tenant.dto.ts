import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TenantStatus } from '@prisma/client';

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
  @IsEnum(TenantStatus) status!: TenantStatus;
}
