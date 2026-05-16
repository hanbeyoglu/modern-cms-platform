import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export type ServiceStatusType = 'ACTIVE' | 'INACTIVE';

export class CreateServiceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  iconMediaId?: string;

  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  iconMediaWidthOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  iconMediaHeightOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  coverMediaWidthOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  coverMediaHeightOverride?: number | null;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  unitNo?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  locationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchTags?: string[];

  @IsOptional()
  @IsBoolean()
  isSoon?: boolean;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: ServiceStatusType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  metadataJson?: unknown;
}
