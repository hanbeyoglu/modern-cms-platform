import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { MediaAssetStatus } from '@prisma/client';

export class ListMediaDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  mallId?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(MediaAssetStatus)
  status?: MediaAssetStatus;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 40;
}

export class ListFoldersDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  mallId?: string;
}
