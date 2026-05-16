import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMediaGuidelineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendedWidth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendedHeight?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  acceptedMimeTypes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  helperText?: string | null;

  @IsOptional()
  @IsBoolean()
  aspectRatioLocked?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
