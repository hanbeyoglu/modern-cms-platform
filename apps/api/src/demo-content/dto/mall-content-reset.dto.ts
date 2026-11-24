import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class MallContentResetDto {
  @IsString()
  @IsNotEmpty()
  confirmName!: string;

  @IsBoolean()
  confirmAgain!: boolean;
}
