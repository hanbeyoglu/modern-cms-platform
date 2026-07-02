/** Prisma connection pool parametrelerini DATABASE_URL'e ekler (Neon/serverless için). */
export function withPrismaPoolLimits(
  url: string,
  limits: { connection_limit?: number; pool_timeout?: number },
): string {
  try {
    const parsed = new URL(url);
    if (limits.connection_limit != null) {
      parsed.searchParams.set('connection_limit', String(limits.connection_limit));
    }
    if (limits.pool_timeout != null) {
      parsed.searchParams.set('pool_timeout', String(limits.pool_timeout));
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function resolveApiDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;
  const limit = Number(process.env.PRISMA_CONNECTION_LIMIT ?? 8);
  const timeout = Number(process.env.PRISMA_POOL_TIMEOUT ?? 20);
  return withPrismaPoolLimits(rawUrl, {
    connection_limit: Number.isFinite(limit) && limit > 0 ? limit : 8,
    pool_timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 20,
  });
}
