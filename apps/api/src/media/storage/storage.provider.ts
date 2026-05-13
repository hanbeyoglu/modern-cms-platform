export interface UploadInput {
  /** Provider-agnostic relative key, e.g. tenants/{id}/media/2025/06/uuid.jpg */
  key: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface UploadResult {
  key: string;
  publicUrl: string;
}

/**
 * Abstract storage provider.
 * Swap the implementation (Local → S3 → R2) without touching MediaService.
 */
export abstract class StorageProvider {
  abstract upload(input: UploadInput): Promise<UploadResult>;
  abstract delete(key: string): Promise<void>;
  abstract getPublicUrl(key: string): string;
}
