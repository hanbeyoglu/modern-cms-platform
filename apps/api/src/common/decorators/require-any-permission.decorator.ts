import { SetMetadata } from '@nestjs/common';
import { ANY_PERMISSIONS_KEY } from '../metadata-keys';

/** User must hold at least one of the listed permissions (OR). */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
