import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class ListTenantsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
}
