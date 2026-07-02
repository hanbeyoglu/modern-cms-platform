import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderMallFloorsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedIds!: string[];
}
