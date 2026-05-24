import { IsOptional, IsString, IsIn } from 'class-validator';
import { LOCALIZED_ENTITY_TYPES } from '../../common/prisma-validation-enums.js';
import type { LocalizedEntityType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class ListTranslationsDto {
  @IsOptional()
  @IsIn(LOCALIZED_ENTITY_TYPES)
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
