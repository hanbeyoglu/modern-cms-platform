import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class EventTranslationDto {
  @IsString()
  localeId!: string;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  coverImageId?: string | null;
}

export class EventTranslationsPayload {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventTranslationDto)
  translations!: EventTranslationDto[];
}
