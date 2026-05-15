import { IsArray, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { PopupStatusType, ChannelType } from './create-popup.dto';

export class UpdatePopupDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageMediaId?: string;

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
  startAt?: string | null;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

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
