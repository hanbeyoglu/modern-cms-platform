import { PageStatus, PageType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsEnum(PageType)
  type?: PageType = PageType.STANDARD;

  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus = PageStatus.DRAFT;

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
}
