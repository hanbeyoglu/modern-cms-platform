import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../metadata-keys';

export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
