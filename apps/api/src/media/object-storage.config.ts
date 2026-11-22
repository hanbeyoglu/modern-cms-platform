import type { ConfigService } from '@nestjs/config';

/**
 * Shared Cloudflare R2 / S3-compatible object storage config checks.
 * Keep MediaModule provider selection and main.ts static serving in sync.
 */
export function isObjectStorageConfigured(config: ConfigService): boolean {
  return Boolean(
    config.get<string>('R2_ACCOUNT_ID')?.trim() &&
      config.get<string>('R2_BUCKET_NAME')?.trim() &&
      config.get<string>('R2_ACCESS_KEY_ID')?.trim() &&
      config.get<string>('R2_SECRET_ACCESS_KEY')?.trim() &&
      config.get<string>('R2_PUBLIC_URL')?.trim(),
  );
}

export function getObjectStoragePublicBase(config: ConfigService): string | null {
  if (!isObjectStorageConfigured(config)) return null;
  return config.get<string>('R2_PUBLIC_URL')!.trim().replace(/\/$/, '');
}

/** Production requires object storage unless explicitly opted into local disk. */
export function isObjectStorageRequired(config: ConfigService): boolean {
  if (config.get<string>('MEDIA_ALLOW_LOCAL_STORAGE')?.trim() === 'true') {
    return false;
  }
  if (config.get<string>('MEDIA_REQUIRE_OBJECT_STORAGE')?.trim() === 'true') {
    return true;
  }
  return config.get<string>('NODE_ENV') === 'production';
}
