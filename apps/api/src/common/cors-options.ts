import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { parseCorsOrigins } from './cors-origins';

/** Headers used by admin JWT clients and public API key clients. */
export const CORS_ALLOWED_HEADERS = [
  'Accept',
  'Content-Type',
  'Authorization',
  'x-api-key',
  'x-tenant-id',
  'x-mall-id',
] as const;

export const CORS_ALLOWED_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
] as const;

/**
 * Build Nest CORS options. Never uses wildcard origin.
 * Credentials stay off unless a caller explicitly overrides.
 */
export function buildCorsOptions(corsOriginsEnv: string): CorsOptions {
  const trimmed = corsOriginsEnv.trim();
  return {
    origin: trimmed.length > 0 ? parseCorsOrigins(trimmed) : true,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: false,
  };
}
