import { IsArray, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export type PopupStatusType = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type ChannelType = 'WEB' | 'MOBILE' | 'KIOSK' | 'SIGNAGE';

export class CreatePopupDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageMediaId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  imageMediaWidthOverride?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : Number(value)))
  @IsInt()
  @Min(1)
  imageMediaHeightOverride?: number | null;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
  status?: PopupStatusType;

  @IsOptional()
  @IsArray()
  @IsEnum(['WEB', 'MOBILE', 'KIOSK', 'SIGNAGE'], { each: true })
  channels?: ChannelType[];

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  showOnce?: boolean;

  @IsOptional()
  @IsBoolean()
  closable?: boolean;

  @IsOptional()
  metadataJson?: unknown;
}
