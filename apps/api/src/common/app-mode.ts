/**
 * Application bootstrap mode. Controls whether optional runtime infrastructure
 * (Redis, BullMQ, schedulers, SMTP, object storage, etc.) is initialized on boot.
 *
 * - `default` (unset): full runtime — production, dev, smoke tests
 * - `swagger`: static OpenAPI artifact generation — no external infrastructure
 */
export type AppMode = 'default' | 'swagger';

export type InfrastructureKind =
  | 'redis'
  | 'bullmq'
  | 'scheduler'
  | 'smtp'
  | 'object-storage'
  | 'message-broker';

const SWAGGER_ALIASES = new Set(['swagger', 'openapi']);

export function getAppMode(): AppMode {
  const raw = process.env.APP_MODE?.trim().toLowerCase();
  if (raw && SWAGGER_ALIASES.has(raw)) {
    return 'swagger';
  }
  return 'default';
}

export function isSwaggerMode(): boolean {
  return getAppMode() === 'swagger';
}

/** Whether the given infrastructure client should be initialized at boot. */
export function shouldInitializeInfrastructure(_kind: InfrastructureKind): boolean {
  return !isSwaggerMode();
}
