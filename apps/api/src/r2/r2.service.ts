import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { shouldInitializeInfrastructure } from '../common/app-mode';

export interface R2UploadInput {
  key: string;
  buffer: Buffer;
  mimeType: string;
}

export interface R2UploadResult {
  key: string;
  url: string;
}

@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private client: S3Client | null = null;
  private bucketName = '';
  private publicUrlBase = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (!shouldInitializeInfrastructure('object-storage')) {
      this.logger.debug('Skipping object storage init — swagger mode');
      return;
    }

    if (!this.isConfigured()) {
      this.logger.warn('R2 is not configured — media uploads will fall back to local storage');
      return;
    }

    const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucketName = this.config.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicUrlBase = this.config.getOrThrow<string>('R2_PUBLIC_URL').replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });

    this.logger.log(`R2 storage ready (bucket=${this.bucketName})`);
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('R2_ACCOUNT_ID')?.trim() &&
        this.config.get<string>('R2_BUCKET_NAME')?.trim() &&
        this.config.get<string>('R2_ACCESS_KEY_ID')?.trim() &&
        this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim() &&
        this.config.get<string>('R2_PUBLIC_URL')?.trim(),
    );
  }

  getPublicUrl(key: string): string {
    const normalizedKey = key.replace(/^\/+/, '');
    return `${this.publicUrlBase}/${normalizedKey}`;
  }

  async upload(input: R2UploadInput): Promise<R2UploadResult> {
    const client = this.requireClient();

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    this.logger.debug(`Uploaded to R2: ${input.key}`);
    return { key: input.key, url: this.getPublicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    const client = this.requireClient();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.debug(`Deleted from R2: ${key}`);
    } catch (err) {
      this.logger.error(`R2 delete failed for key ${key}`, err);
      throw err;
    }
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new Error('R2 client is not configured');
    }
    return this.client;
  }
}
