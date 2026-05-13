import { SetMetadata } from '@nestjs/common';
import { AUDIT_ACTION_KEY } from '../metadata-keys';

export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
