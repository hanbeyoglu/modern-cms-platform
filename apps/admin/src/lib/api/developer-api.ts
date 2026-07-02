import { request } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApiKeyEnvironment = 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
export type ApiKeyStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export type ApiKey = {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  status: ApiKeyStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
};

export type ApiKeyCreated = ApiKey & { rawKey: string };

export type AllowedDomain = {
  id: string;
  domain: string;
  createdAt: string;
};

export type RateLimitConfig = {
  requestsPerMinute: number;
};

export type ApiRequestLog = {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  origin: string | null;
  ipAddress: string | null;
  createdAt: string;
  apiKey: { id: string; name: string; keyPrefix: string } | null;
};

export type ApiAnalytics = {
  todayRequests: number;
  last7Days: { date: string; requestCount: number; successCount: number; errorCount: number }[];
  topEndpoints: { endpoint: string; count: number }[];
  failedRequests: number;
  lastUsedKey: { id: string; name: string; lastUsedAt: string } | null;
};

// ── API Keys ──────────────────────────────────────────────────────────────────

export function apiDevKeysGet(token: string, tenantId: string): Promise<ApiKey[]> {
  return request(`/developer-api/keys?tenantId=${tenantId}`, { token, tenantId });
}

export function apiDevKeyCreate(
  token: string,
  tenantId: string,
  data: { name: string; description?: string; environment?: ApiKeyEnvironment },
): Promise<ApiKeyCreated> {
  return request(`/developer-api/keys?tenantId=${tenantId}`, {
    method: 'POST',
    body: JSON.stringify(data),
    token,
    tenantId,
  });
}

export function apiDevKeyUpdate(
  token: string,
  tenantId: string,
  keyId: string,
  data: { name?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' },
): Promise<ApiKey> {
  return request(`/developer-api/keys/${keyId}?tenantId=${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
    tenantId,
  });
}

export function apiDevKeyRevoke(token: string, tenantId: string, keyId: string): Promise<void> {
  return request(`/developer-api/keys/${keyId}/revoke?tenantId=${tenantId}`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export function apiDevKeyRegenerate(
  token: string,
  tenantId: string,
  keyId: string,
): Promise<ApiKeyCreated> {
  return request(`/developer-api/keys/${keyId}/regenerate?tenantId=${tenantId}`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export function apiDevKeyDelete(token: string, tenantId: string, keyId: string): Promise<void> {
  return request(`/developer-api/keys/${keyId}?tenantId=${tenantId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

// ── Allowed Domains ───────────────────────────────────────────────────────────

export function apiDevDomainsGet(token: string, tenantId: string): Promise<AllowedDomain[]> {
  return request(`/developer-api/domains?tenantId=${tenantId}`, { token, tenantId });
}

export function apiDevDomainAdd(
  token: string,
  tenantId: string,
  domain: string,
): Promise<AllowedDomain> {
  return request(`/developer-api/domains?tenantId=${tenantId}`, {
    method: 'POST',
    body: JSON.stringify({ domain }),
    token,
    tenantId,
  });
}

export function apiDevDomainRemove(
  token: string,
  tenantId: string,
  domainId: string,
): Promise<void> {
  return request(`/developer-api/domains/${domainId}?tenantId=${tenantId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

// ── Rate Limits ───────────────────────────────────────────────────────────────

export function apiDevRateLimitGet(token: string, tenantId: string): Promise<RateLimitConfig> {
  return request(`/developer-api/rate-limit?tenantId=${tenantId}`, { token, tenantId });
}

export function apiDevRateLimitUpdate(
  token: string,
  tenantId: string,
  requestsPerMinute: number,
): Promise<RateLimitConfig> {
  return request(`/developer-api/rate-limit?tenantId=${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ requestsPerMinute }),
    token,
    tenantId,
  });
}

// ── API Logs ──────────────────────────────────────────────────────────────────

export function apiDevLogsGet(
  token: string,
  tenantId: string,
  params?: { limit?: number; apiKeyId?: string },
): Promise<ApiRequestLog[]> {
  const qs = new URLSearchParams({ tenantId });
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.apiKeyId) qs.set('apiKeyId', params.apiKeyId);
  return request(`/developer-api/logs?${qs}`, { token, tenantId });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function apiDevAnalyticsGet(token: string, tenantId: string): Promise<ApiAnalytics> {
  return request(`/developer-api/analytics?tenantId=${tenantId}`, { token, tenantId });
}
