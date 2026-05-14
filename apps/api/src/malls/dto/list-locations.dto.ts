import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LocationType, MallStatus } from '@prisma/client';

export class ListLocationsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(LocationType) type?: LocationType;
  @IsOptional() @IsEnum(MallStatus) status?: MallStatus;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() tenantId?: string;
}
