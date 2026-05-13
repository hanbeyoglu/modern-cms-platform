import { SetMetadata } from '@nestjs/common';
import { REQUIRE_TENANT_CONTEXT_KEY } from '../metadata-keys';

/**
 * x-tenant-id başlığının doğrulanmasını gerektirir (süper admin için isteğe bağlı davranış guard içinde ele alınır).
 */
export const RequireTenantContext = () => SetMetadata(REQUIRE_TENANT_CONTEXT_KEY, true);
