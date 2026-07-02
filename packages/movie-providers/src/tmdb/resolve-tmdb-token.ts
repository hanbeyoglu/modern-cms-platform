import type { TmdbProviderSettings } from '../types';

/** Tenant ayarı öncelikli; boşsa TMDB_API_READ_ACCESS_TOKEN ortam değişkeni kullanılır. */
export function resolveTmdbAccessToken(
  tenantToken?: string,
  envToken = process.env.TMDB_API_READ_ACCESS_TOKEN,
): string {
  const fromTenant = tenantToken?.trim() ?? '';
  if (fromTenant) return fromTenant;
  return envToken?.trim() ?? '';
}

export type TmdbAccessTokenSource = 'tenant' | 'env' | 'none';

export function getTmdbAccessTokenSource(
  tenantToken?: string,
  envToken = process.env.TMDB_API_READ_ACCESS_TOKEN,
): TmdbAccessTokenSource {
  if (tenantToken?.trim()) return 'tenant';
  if (envToken?.trim()) return 'env';
  return 'none';
}

export function resolveTmdbSettingsForRuntime(
  settings: TmdbProviderSettings,
  envToken = process.env.TMDB_API_READ_ACCESS_TOKEN,
): TmdbProviderSettings & { readAccessTokenSource: TmdbAccessTokenSource } {
  return {
    ...settings,
    readAccessToken: resolveTmdbAccessToken(settings.readAccessToken, envToken),
    readAccessTokenSource: getTmdbAccessTokenSource(settings.readAccessToken, envToken),
  };
}
