import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { PopupStatusType, ChannelType } from './create-popup.dto';

export class ListPopupsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
  status?: PopupStatusType;

  @IsOptional()
  @IsEnum(['WEB', 'MOBILE', 'KIOSK', 'SIGNAGE'])
  channel?: ChannelType;

  @IsOptional()
  @IsString()
  search?: string;
}
