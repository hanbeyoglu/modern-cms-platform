import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const PUBLIC_TYPES = ['PAGE', 'EVENT', 'CAMPAIGN', 'MALL_STORE', 'MOVIE', 'CINEMA'] as const;

export class PublicSearchQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn([...PUBLIC_TYPES])
  type?: (typeof PUBLIC_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
