import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderStoreCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds!: string[];
}
