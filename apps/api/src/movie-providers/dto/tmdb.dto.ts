import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class TmdbSearchDto {
  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => (value !== undefined && value !== '' ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number;
}

export class TmdbBrowseDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => (value !== undefined && value !== '' ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number;
}

export class TmdbImportDto {
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  tmdbId!: number;
}
