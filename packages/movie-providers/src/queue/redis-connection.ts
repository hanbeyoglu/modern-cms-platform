export type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

export function parseRedisConnection(redisUrl: string): RedisConnectionOptions {
  const parsed = new URL(redisUrl);
  const db = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined;

  if (db !== undefined && (!Number.isInteger(db) || db < 0)) {
    throw new Error(`Invalid Redis database in REDIS_URL: ${parsed.pathname}`);
  }

  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

export function maskRedisUrl(redisUrl: string): string {
  try {
    const parsed = new URL(redisUrl);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '(invalid REDIS_URL)';
  }
}
