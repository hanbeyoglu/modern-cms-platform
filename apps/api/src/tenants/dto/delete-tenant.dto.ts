import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';

export enum TenantDeleteMode {
  SOFT = 'SOFT',
  HARD = 'HARD',
}

export class DeleteTenantDto {
  @ApiProperty({ enum: TenantDeleteMode, example: TenantDeleteMode.SOFT })
  @IsEnum(TenantDeleteMode)
  mode!: TenantDeleteMode;

  @ApiProperty({ description: 'Tenant slug typed by admin to confirm deletion', example: 'emaar-avm' })
  @IsString()
  @MinLength(1)
  confirmSlug!: string;
}
