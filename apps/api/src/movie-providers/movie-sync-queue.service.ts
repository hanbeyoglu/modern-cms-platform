import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  MOVIE_SYNC_QUEUE_NAME,
  parseRedisConnection,
  type MovieSyncJobData,
} from '@modern-cms/movie-providers';
import { shouldInitializeInfrastructure } from '../common/app-mode';

@Injectable()
export class MovieSyncQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<MovieSyncJobData> | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (shouldInitializeInfrastructure('bullmq')) {
      this.getQueue();
    }
  }

  private getQueue(): Queue<MovieSyncJobData> {
    if (!shouldInitializeInfrastructure('bullmq')) {
      throw new Error('BullMQ is not initialized in swagger mode');
    }
    if (!this.queue) {
      const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
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
    return this.queue;
  }

  async enqueueSync(data: MovieSyncJobData): Promise<string> {
    const job = await this.getQueue().add('sync', data, {
      jobId: `sync-${data.tenantId}-${Date.now()}`,
    });
    return job.id ?? 'unknown';
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }
}
