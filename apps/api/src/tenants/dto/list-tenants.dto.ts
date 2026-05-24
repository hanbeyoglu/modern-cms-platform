import { IsOptional, IsString, IsIn } from 'class-validator';
import { TENANT_STATUSES } from '../../common/prisma-validation-enums.js';
import type { TenantStatus } from '@prisma/client';

export class ListTenantsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(TENANT_STATUSES) status?: TenantStatus;
}
