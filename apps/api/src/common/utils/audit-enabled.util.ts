import type { ConfigService } from '@nestjs/config';

/**
 * Audit logging is temporarily disabled for MVP/demo deployments.
 * Enterprise customers can enable it through AUDIT_ENABLED=true.
 */
export function isAuditEnabled(config: ConfigService): boolean {
  return config.get<string>('AUDIT_ENABLED') === 'true';
}
