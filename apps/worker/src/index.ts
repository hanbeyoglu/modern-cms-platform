import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const pollMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? '5000');

async function main(): Promise<void> {
  const client = createClient({ url: redisUrl });
  client.on('error', (err) => console.error('[worker] redis error', err));

  await client.connect();
  console.log(`[worker] redis connected (${redisUrl})`);

  const timer = setInterval(async () => {
    try {
      const pong = await client.ping();
      console.log(`[worker] tick ok=${pong} at=${new Date().toISOString()}`);
    } catch (err) {
      console.error('[worker] tick failed', err);
    }
  }, pollMs);

  const shutdown = async () => {
    clearInterval(timer);
    await client.quit().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
