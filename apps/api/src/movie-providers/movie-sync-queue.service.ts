import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  MOVIE_SYNC_QUEUE_NAME,
  parseRedisConnection,
  type MovieSyncJobData,
} from '@modern-cms/movie-providers';

@Injectable()
export class MovieSyncQueueService implements OnModuleDestroy {
  private readonly queue: Queue<MovieSyncJobData>;

  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.queue = new Queue<MovieSyncJobData>(MOVIE_SYNC_QUEUE_NAME, {
      connection: parseRedisConnection(redisUrl),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
  }

  async enqueueSync(data: MovieSyncJobData): Promise<string> {
    const job = await this.queue.add('sync', data, {
      jobId: `sync-${data.tenantId}-${Date.now()}`,
    });
    return job.id ?? 'unknown';
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
