import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CampaignTranslationDto {
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
  coverImageId?: string | null;
}

export class CampaignTranslationsPayload {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignTranslationDto)
  translations!: CampaignTranslationDto[];
}
