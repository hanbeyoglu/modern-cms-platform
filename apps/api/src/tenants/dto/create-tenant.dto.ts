import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class CreateTenantDto {
  @IsString() name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsString() billingEmail?: string;
  @IsOptional() addressJson?: unknown;
  @IsOptional() metadataJson?: unknown;
}
