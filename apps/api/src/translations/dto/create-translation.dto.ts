import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { LOCALIZED_ENTITY_TYPES } from '../../common/prisma-validation-enums.js';
import type { LocalizedEntityType } from '@prisma/client';

export class CreateTranslationDto {
  @IsOptional()
  @IsString()
  localeId?: string;

  @IsOptional()
  @IsString()
  localeCode?: string;

  @IsIn(LOCALIZED_ENTITY_TYPES)
  entityType!: LocalizedEntityType;

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsString()
  @IsNotEmpty()
  field!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}
