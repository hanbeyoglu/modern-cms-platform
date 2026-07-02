import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class TmdbBulkImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((v) => Number(v)) : value,
  )
  @IsInt({ each: true })
  @Min(1, { each: true })
  tmdbIds!: number[];
}
