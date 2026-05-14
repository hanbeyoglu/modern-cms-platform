import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderLocalesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds!: string[];
}
