import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  refreshToken!: string;
}
