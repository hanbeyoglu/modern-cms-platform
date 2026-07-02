/**
 * Audit logging is temporarily disabled for MVP/demo deployments.
 * Enterprise customers can enable it through AUDIT_ENABLED on the API
 * and VITE_AUDIT_ENABLED=true on the admin build.
 */
export function isAuditEnabled(): boolean {
  return import.meta.env.VITE_AUDIT_ENABLED === 'true';
}
