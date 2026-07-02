import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import {
  MOVIE_IMPORT_QUEUE_NAME,
  buildImportProgress,
  parseRedisConnection,
  movieImportJobId,
  parseJobProgress,
  type MovieImportBatchProgress,
  type MovieImportBulkJobData,
} from '@modern-cms/movie-providers';
import { shouldInitializeInfrastructure } from '../common/app-mode';

@Injectable()
export class MovieImportQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MovieImportQueueService.name);
  private queue: Queue<MovieImportBulkJobData> | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (shouldInitializeInfrastructure('bullmq')) {
      this.getQueue();
    }
  }

  private getQueue(): Queue<MovieImportBulkJobData> {
    if (!shouldInitializeInfrastructure('bullmq')) {
      throw new Error('BullMQ is not initialized in swagger mode');
    }
    if (!this.queue) {
      const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      this.queue = new Queue<MovieImportBulkJobData>(MOVIE_IMPORT_QUEUE_NAME, {
        connection: parseRedisConnection(redisUrl),
        defaultJobOptions: {
          removeOnComplete: 200,
          removeOnFail: 200,
          attempts: 1,
        },
      });
    }
    return this.queue;
  }

  async enqueueBulkImport(
    data: Omit<MovieImportBulkJobData, 'batchId'> & { batchId?: string },
  ): Promise<{ batchId: string; jobId: string }> {
    const batchId = data.batchId ?? randomUUID();
    const jobId = movieImportJobId(batchId);
    const payload: MovieImportBulkJobData = { ...data, batchId };

    const job = await this.getQueue().add('bulk-import', payload, { jobId });

    const queued = buildImportProgress(payload, {
      status: 'queued',
      processed: 0,
      newMovies: 0,
      updatedMovies: 0,
      failedMovies: 0,
      startedAt: new Date().toISOString(),
    });
    await job.updateProgress(queued);

    this.logger.log(
      `[MovieImport] Batch created batchId=${batchId} jobId=${job.id ?? jobId} total=${data.tmdbIds.length}`,
    );

    return { batchId, jobId: job.id ?? jobId };
  }

  async getProgress(batchId: string, tenantId: string): Promise<MovieImportBatchProgress | null> {
    const jobId = movieImportJobId(batchId);
    const job = await this.getQueue().getJob(jobId);
    if (!job) {
      this.logger.warn(`[MovieImport] Job not found jobId=${jobId}`);
      return null;
    }
    if (job.data.tenantId !== tenantId) {
      return null;
    }

    const state = await job.getState();
    const progress = parseJobProgress(job.data, state, job.progress);
    this.logger.debug(
      `[MovieImport] Progress read batchId=${batchId} state=${state} ${progress.processed}/${progress.total} (${progress.percent}%)`,
    );
    return progress;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }
}
