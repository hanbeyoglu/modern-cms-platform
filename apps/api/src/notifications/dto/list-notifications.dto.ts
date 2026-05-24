import { Transform } from 'class-transformer';
import { NOTIFICATION_TYPES, NOTIFICATION_SEVERITIES } from '../../common/prisma-validation-enums.js';
import { IsBoolean, IsInt, IsOptional, Max, Min, IsIn } from 'class-validator';
import type { NotificationSeverity, NotificationType } from '@prisma/client';

export class ListNotificationsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @IsIn(NOTIFICATION_SEVERITIES)
  severity?: NotificationSeverity;

  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: NotificationType;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : 30))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : 0))
  @IsInt()
  @Min(0)
  skip?: number;
}
