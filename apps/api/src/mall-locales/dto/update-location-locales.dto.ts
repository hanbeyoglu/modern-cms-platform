import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

export class LocationLocaleToggleDto {
  @IsString()
  localeId!: string;

  @IsBoolean()
  isActive!: boolean;
}

export class UpdateLocationLocalesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationLocaleToggleDto)
  locales!: LocationLocaleToggleDto[];
}
