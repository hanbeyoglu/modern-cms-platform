import { IsArray, IsBoolean, IsString } from 'class-validator';

export class CapabilityToggleItem {
  @IsString()
  code!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateTenantCapabilitiesDto {
  @IsArray()
  capabilities!: CapabilityToggleItem[];
}
