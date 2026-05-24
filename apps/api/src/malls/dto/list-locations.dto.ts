import { IsOptional, IsString, IsIn } from 'class-validator';
import { MALL_STATUSES, LOCATION_TYPES } from '../../common/prisma-validation-enums.js';
import type { LocationType, MallStatus } from '@prisma/client';

export class ListLocationsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(LOCATION_TYPES) type?: LocationType;
  @IsOptional() @IsIn(MALL_STATUSES) status?: MallStatus;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() tenantId?: string;
}
