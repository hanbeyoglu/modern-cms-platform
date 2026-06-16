import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SliderItemTranslationDto {
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
  buttonText?: string | null;

  @IsOptional()
  @IsString()
  imageId?: string | null;

  @IsOptional()
  @IsString()
  mobileImageId?: string | null;
}

export class SliderItemTranslationsPayload {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SliderItemTranslationDto)
  translations!: SliderItemTranslationDto[];
}
