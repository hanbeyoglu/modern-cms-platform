import { IsArray, IsNumber, IsOptional, IsString, Max, MaxLength, Min, IsIn } from 'class-validator';
import { MEDIA_ASSET_STATUSES } from '../../common/prisma-validation-enums.js';
import type { MediaAssetStatus } from '@prisma/client';

export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalPointX?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  focalPointY?: number;

  @IsOptional()
  @IsIn(MEDIA_ASSET_STATUSES)
  status?: MediaAssetStatus;
}
