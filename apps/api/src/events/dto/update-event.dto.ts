import { ContentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverMediaId?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsObject()
  dynamicFieldsJson?: Record<string, unknown> | null;

  /** null = tenant geneli */
  @IsOptional()
  @IsString()
  mallId?: string | null;
}
