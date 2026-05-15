import { IsOptional, IsString } from 'class-validator';

export class MoveMediaDto {
  @IsOptional()
  @IsString()
  folderId?: string | null;
}
