import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DemoImportDto {
  @ApiPropertyOptional({
    description:
      'Açıkken kampanya/etkinlik süreleri korunarak tarihler import gününe kaydırılır; film seansları bugüne yazılır.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  shiftDates?: boolean;
}
