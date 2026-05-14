import { IsOptional, IsString, IsIn } from 'class-validator';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  mallId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED', 'INVITED'])
  status?: string;
}
