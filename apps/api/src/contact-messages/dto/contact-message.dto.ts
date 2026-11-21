import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export const CONTACT_STATUSES = ['NEW', 'READ', 'ARCHIVED'] as const;
export class CreateContactMessageDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
  @ApiProperty({ maxLength: 254 }) @Transform(trim) @IsEmail() @MaxLength(254) email!: string;
  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(180)
  subject?: string;
  @ApiProperty({ maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;
  @ApiProperty({ enum: [true] }) @IsBoolean() @Equals(true) kvkkConsent!: boolean;
  @ApiPropertyOptional({ description: 'Leave empty (honeypot).', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
export class ListContactMessagesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsIn(CONTACT_STATUSES) status?: (typeof CONTACT_STATUSES)[number];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
export class UpdateContactMessageStatusDto {
  @ApiProperty({ enum: CONTACT_STATUSES })
  @IsIn(CONTACT_STATUSES)
  status!: (typeof CONTACT_STATUSES)[number];
}
