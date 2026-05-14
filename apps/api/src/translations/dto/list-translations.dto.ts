import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LocalizedEntityType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class ListTranslationsDto {
  @IsOptional()
  @IsEnum(LocalizedEntityType)
  entityType?: LocalizedEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  localeId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  localeCode?: string;

  @IsOptional()
  @IsString()
  field?: string;
}
