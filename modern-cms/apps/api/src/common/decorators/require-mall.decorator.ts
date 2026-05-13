import { SetMetadata } from '@nestjs/common';
import { REQUIRE_MALL_CONTEXT_KEY } from '../metadata-keys';

/**
 * x-mall-id başlığı gönderildiğinde AVM erişiminin doğrulanmasını zorunlu kılar.
 */
export const RequireMallContext = () => SetMetadata(REQUIRE_MALL_CONTEXT_KEY, true);
