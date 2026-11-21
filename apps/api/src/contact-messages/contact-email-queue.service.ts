import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  CONTACT_EMAIL_QUEUE_NAME,
  contactEmailJobId,
  type ContactEmailJobData,
} from '@modern-cms/mail';
import { parseRedisConnection } from '@modern-cms/movie-providers';
import { shouldInitializeInfrastructure } from '../common/app-mode';

@Injectable()
export class ContactEmailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContactEmailQueueService.name);
  private queue: Queue<ContactEmailJobData> | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (shouldInitializeInfrastructure('bullmq')) {
      this.getQueue();
    }
  }

  private getQueue(): Queue<ContactEmailJobData> {
    if (!shouldInitializeInfrastructure('bullmq')) {
      throw new Error('BullMQ is not initialized in swagger mode');
    }
    if (!this.queue) {
      const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      this.queue = new Queue<ContactEmailJobData>(CONTACT_EMAIL_QUEUE_NAME, {
        connection: parseRedisConnection(redisUrl),
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 200,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
        },
      });
    }
    return this.queue;
  }

  async enqueueNotification(data: ContactEmailJobData): Promise<void> {
    const jobId = contactEmailJobId(data.messageId);
    try {
      await this.getQueue().add('notify', data, { jobId });
    } catch (err) {
      // Duplicate job id while an active/waiting job exists is fine for idempotency.
      const message = err instanceof Error ? err.message : String(err);
      if (/already exists/i.test(message)) {
        this.logger.debug(`Contact email job already queued id=${jobId}`);
        return;
      }
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
    }
  }
}
