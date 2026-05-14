import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LocalizedEntityType } from '@prisma/client';

export class CreateTranslationDto {
  @IsOptional()
  @IsString()
  localeId?: string;

  @IsOptional()
  @IsString()
  localeCode?: string;

  @IsEnum(LocalizedEntityType)
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
