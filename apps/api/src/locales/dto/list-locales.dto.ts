import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListLocalesDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
