import { SetMetadata } from '@nestjs/common';
import { CAPABILITY_KEY } from '../../common/metadata-keys';

export const RequireCapability = (code: string) => SetMetadata(CAPABILITY_KEY, code);
