import type { PageStatus, PageType } from '@prisma/client';
import { PAGE_STATUSES, PAGE_TYPES } from '../../common/prisma-validation-enums.js';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, ValidateNested, IsIn } from 'class-validator';
import { PageAttachmentDto } from './page-attachment.dto';

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsIn(PAGE_TYPES)
  type?: PageType;

  @IsOptional()
  @IsString()
  customTypeLabel?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsIn(PAGE_STATUSES)
  status?: PageStatus;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  seoKeywords?: string;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  unpublishAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageAttachmentDto)
  attachments?: PageAttachmentDto[];
}
