import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderBlockItem {
  @IsString()
  id!: string;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderBlocksDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderBlockItem)
  blocks!: ReorderBlockItem[];
}
