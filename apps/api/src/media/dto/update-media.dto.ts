import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MediaAssetStatus } from '@prisma/client';

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
  @IsEnum(MediaAssetStatus)
  status?: MediaAssetStatus;
}
