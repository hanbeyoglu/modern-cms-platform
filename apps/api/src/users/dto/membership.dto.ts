import { IsNotEmpty, IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';

export class CreateMembershipDto {
  @IsNotEmpty()
  @IsString()
  tenantId!: string;

  @IsNotEmpty()
  @IsString()
  roleId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mallIds?: string[];
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mallIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
